from __future__ import annotations

from datetime import date, timedelta
from io import BytesIO

from fastapi import APIRouter, Depends, Header
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle
from sqlalchemy import text

from app.api.admin_auth import AdminPrincipal, require_admin, require_permission
from app.db import engine

router = APIRouter()


@router.get("/api/admin/overview", tags=["admin-overview"])
def admin_overview(
    principal: AdminPrincipal = Depends(require_admin),
) -> dict:
    require_permission(principal, "read")

    start = date.today() - timedelta(days=4)
    end = date.today()

    with engine.connect() as conn:
        units = int(conn.execute(text("SELECT COUNT(*) FROM units")).scalar_one() or 0)
        restaurants = int(conn.execute(text("SELECT COUNT(*) FROM restaurants")).scalar_one() or 0)
        published_menus = int(
            conn.execute(
                text("SELECT COUNT(*) FROM menu_imports WHERE status = 'published'")
            ).scalar_one()
            or 0
        )
        technical_sheets = int(
            conn.execute(text("SELECT COUNT(*) FROM technical_sheets")).scalar_one() or 0
        )
        complete_sheets = int(
            conn.execute(
                text(
                    """
                    SELECT COUNT(*) FROM technical_sheets
                    WHERE kcal IS NOT NULL
                      AND protein_g IS NOT NULL
                      AND carbs_g IS NOT NULL
                      AND fat_g IS NOT NULL
                    """
                )
            ).scalar_one()
            or 0
        )
        enriched_menu_items = int(
            conn.execute(
                text("SELECT COUNT(*) FROM menu_items WHERE technical_sheet_code IS NOT NULL")
            ).scalar_one()
            or 0
        )
        total_menu_items = int(
            conn.execute(text("SELECT COUNT(*) FROM menu_items")).scalar_one() or 0
        )

        feedback = conn.execute(
            text(
                """
                SELECT COUNT(*) AS responses,
                       ROUND(AVG((food_rating + service_rating) / 2.0)::numeric, 2) AS overall
                FROM feedback
                WHERE meal_date BETWEEN :start AND :end
                """
            ),
            {"start": start, "end": end},
        ).mappings().one()

        top_tag = conn.execute(
            text(
                """
                SELECT ft.tag, COUNT(*) AS count
                FROM feedback_tags ft
                JOIN feedback f ON f.id = ft.feedback_id
                WHERE f.meal_date BETWEEN :start AND :end
                GROUP BY ft.tag
                ORDER BY count DESC, ft.tag
                LIMIT 1
                """
            ),
            {"start": start, "end": end},
        ).mappings().one_or_none()

        latest_menu = conn.execute(
            text(
                """
                SELECT mi.period_start, mi.period_end, mi.published_at, u.name AS unit_name
                FROM menu_imports mi
                JOIN units u ON u.id = mi.unit_id
                WHERE mi.status = 'published'
                ORDER BY mi.published_at DESC NULLS LAST
                LIMIT 1
                """
            )
        ).mappings().one_or_none()

        unit_rows = conn.execute(
            text(
                """
                SELECT
                    u.id AS unit_id,
                    u.name AS unit_name,
                    c.name AS company_name,
                    COUNT(DISTINCT CASE WHEN mi.status = 'published' THEN mi.id END) AS published_menus,
                    COUNT(DISTINCT md.id) AS menu_days,
                    COUNT(DISTINCT mitem.id) AS menu_items,
                    COUNT(DISTINCT CASE WHEN mitem.technical_sheet_code IS NOT NULL THEN mitem.id END) AS enriched_items,
                    COUNT(DISTINCT f.id) FILTER (WHERE f.meal_date BETWEEN :start AND :end) AS feedback_responses,
                    ROUND(
                        AVG((f.food_rating + f.service_rating) / 2.0)
                        FILTER (WHERE f.meal_date BETWEEN :start AND :end)::numeric,
                        2
                    ) AS satisfaction
                FROM units u
                LEFT JOIN companies c ON c.id = u.company_id
                LEFT JOIN menu_imports mi ON mi.unit_id = u.id
                LEFT JOIN menu_days md ON md.unit_id = u.id
                LEFT JOIN menu_items mitem ON mitem.menu_day_id = md.id
                LEFT JOIN feedback f ON f.unit_id = u.id
                GROUP BY u.id, u.name, c.name
                ORDER BY c.name, u.name
                """
            ),
            {"start": start, "end": end},
        ).mappings().all()

    coverage = round((enriched_menu_items / total_menu_items) * 100) if total_menu_items else 0

    unit_comparison = []
    for row in unit_rows:
        menu_items_count = int(row["menu_items"] or 0)
        enriched_count = int(row["enriched_items"] or 0)
        unit_comparison.append(
            {
                "unit_id": str(row["unit_id"]),
                "unit_name": row["unit_name"],
                "company_name": row["company_name"],
                "published_menus": int(row["published_menus"] or 0),
                "menu_days": int(row["menu_days"] or 0),
                "menu_items": menu_items_count,
                "enriched_items": enriched_count,
                "technical_coverage_percent": round((enriched_count / menu_items_count) * 100) if menu_items_count else 0,
                "feedback_responses": int(row["feedback_responses"] or 0),
                "satisfaction": float(row["satisfaction"]) if row["satisfaction"] is not None else None,
            }
        )

    return {
        "units": units,
        "restaurants": restaurants,
        "published_menus": published_menus,
        "technical_sheets": technical_sheets,
        "complete_sheets": complete_sheets,
        "menu_items": total_menu_items,
        "enriched_menu_items": enriched_menu_items,
        "technical_coverage_percent": coverage,
        "feedback_period_start": start.isoformat(),
        "feedback_period_end": end.isoformat(),
        "feedback_responses": int(feedback["responses"] or 0),
        "satisfaction_overall": float(feedback["overall"]) if feedback["overall"] is not None else None,
        "top_feedback_tag": dict(top_tag) if top_tag else None,
        "unit_comparison": unit_comparison,
        "latest_menu": {
            "unit_name": latest_menu["unit_name"],
            "period_start": latest_menu["period_start"].isoformat() if latest_menu["period_start"] else None,
            "period_end": latest_menu["period_end"].isoformat() if latest_menu["period_end"] else None,
            "published_at": latest_menu["published_at"].isoformat() if latest_menu["published_at"] else None,
        } if latest_menu else None,
    }


def _report_pdf(payload: dict) -> bytes:
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=14 * mm,
        leftMargin=14 * mm,
        topMargin=14 * mm,
        bottomMargin=14 * mm,
        title="APETIT - Relatorio Executivo",
        author="APETIT",
    )
    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            name="ReportTitle",
            parent=styles["Title"],
            fontName="Helvetica-Bold",
            fontSize=20,
            leading=24,
            textColor=colors.HexColor("#171717"),
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Eyebrow",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=8,
            leading=10,
            textColor=colors.HexColor("#EC003F"),
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            name="Muted",
            parent=styles["Normal"],
            fontSize=8.5,
            leading=12,
            textColor=colors.HexColor("#66666E"),
        )
    )
    styles.add(
        ParagraphStyle(
            name="Kpi",
            parent=styles["Normal"],
            fontName="Helvetica-Bold",
            fontSize=18,
            leading=20,
            alignment=TA_CENTER,
        )
    )

    story = [
        Paragraph("APETIT · RELATORIO EXECUTIVO", styles["Eyebrow"]),
        Paragraph("Operacao, experiencia e qualidade da base", styles["ReportTitle"]),
        Paragraph(
            "Ambiente de demonstracao com dados ficticios e agregados. "
            "Nenhuma prescricao, restricao ou historico alimentar individual e exibido.",
            styles["Muted"],
        ),
        Spacer(1, 8),
    ]

    satisfaction = payload.get("satisfaction_overall")
    kpis = [
        ["Unidades", "Cardapios publicados", "Fichas tecnicas", "Satisfacao geral"],
        [
            str(payload.get("units", 0)),
            str(payload.get("published_menus", 0)),
            str(payload.get("technical_sheets", 0)),
            "—" if satisfaction is None else f"{satisfaction:.1f}",
        ],
        [
            f"{payload.get('restaurants', 0)} refeitorios",
            f"{payload.get('menu_items', 0)} itens",
            f"{payload.get('complete_sheets', 0)} completas",
            f"{payload.get('feedback_responses', 0)} respostas",
        ],
    ]
    kpi_table = Table(kpis, colWidths=[43 * mm] * 4)
    kpi_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F7F7F8")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.HexColor("#77777F")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTNAME", (0, 1), (-1, 1), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, 0), 7),
                ("FONTSIZE", (0, 1), (-1, 1), 16),
                ("FONTSIZE", (0, 2), (-1, 2), 7),
                ("ALIGN", (0, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E4E4E8")),
                ("BOX", (0, 0), (-1, -1), 0.8, colors.HexColor("#DCDCE1")),
                ("TOPPADDING", (0, 0), (-1, -1), 7),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ]
        )
    )
    story += [kpi_table, Spacer(1, 12)]

    story += [
        Paragraph("QUALIDADE DA BASE", styles["Eyebrow"]),
        Paragraph("Cobertura de fichas tecnicas", styles["Heading2"]),
        Paragraph(
            f"{payload.get('technical_coverage_percent', 0)}% de cobertura - "
            f"{payload.get('enriched_menu_items', 0)} de "
            f"{payload.get('menu_items', 0)} itens associados.",
            styles["Muted"],
        ),
        Spacer(1, 10),
        Paragraph("COMPARATIVO ENTRE UNIDADES", styles["Eyebrow"]),
    ]

    unit_rows = [["Unidade", "Satisfacao", "Respostas", "Cardapios", "Cobertura"]]
    for unit in payload.get("unit_comparison", []):
        sat = unit.get("satisfaction")
        unit_rows.append(
            [
                unit.get("company_name") or unit.get("unit_name") or "—",
                "—" if sat is None else f"{sat:.1f}",
                str(unit.get("feedback_responses", 0)),
                str(unit.get("published_menus", 0)),
                f"{unit.get('technical_coverage_percent', 0)}%",
            ]
        )

    unit_table = Table(
        unit_rows,
        colWidths=[58 * mm, 29 * mm, 29 * mm, 29 * mm, 29 * mm],
        repeatRows=1,
    )
    unit_table.setStyle(
        TableStyle(
            [
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F7F7F8")),
                ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                ("FONTSIZE", (0, 0), (-1, -1), 8),
                ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E5E8")),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ]
        )
    )
    story += [unit_table, Spacer(1, 12)]

    alerts: list[list[str]] = []
    for unit in payload.get("unit_comparison", []):
        if unit.get("technical_coverage_percent", 0) < 80:
            alerts.append(
                [
                    "Atencao",
                    f"{unit.get('company_name', 'Unidade')}: cobertura tecnica "
                    f"{unit.get('technical_coverage_percent', 0)}%.",
                ]
            )
        satisfaction = unit.get("satisfaction")
        if satisfaction is not None and satisfaction < 4:
            alerts.append(
                [
                    "Alta",
                    f"{unit.get('company_name', 'Unidade')}: satisfacao "
                    f"{satisfaction:.1f}.",
                ]
            )
        if unit.get("published_menus", 0) == 0:
            alerts.append(
                [
                    "Alta",
                    f"{unit.get('company_name', 'Unidade')}: sem cardapio publicado.",
                ]
            )

    incomplete = payload.get("technical_sheets", 0) - payload.get("complete_sheets", 0)
    if incomplete > 0:
        alerts.append(["Atencao", f"{incomplete} ficha(s) tecnica(s) incompleta(s)."])

    story += [
        Paragraph("ALERTAS OPERACIONAIS", styles["Eyebrow"]),
        Paragraph("Pontos que exigem atencao", styles["Heading2"]),
    ]
    if alerts:
        alert_table = Table([["Prioridade", "Alerta"], *alerts], colWidths=[28 * mm, 146 * mm])
        alert_table.setStyle(
            TableStyle(
                [
                    ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F7F7F8")),
                    ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
                    ("FONTSIZE", (0, 0), (-1, -1), 8),
                    ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#E5E5E8")),
                    ("TOPPADDING", (0, 0), (-1, -1), 6),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
                ]
            )
        )
        story.append(alert_table)
    else:
        story.append(
            Paragraph(
                "Nenhum alerta operacional relevante no periodo.",
                styles["Muted"],
            )
        )

    latest = payload.get("latest_menu")
    story += [
        Spacer(1, 12),
        Paragraph("ULTIMA PUBLICACAO", styles["Eyebrow"]),
        Paragraph(
            latest.get("unit_name", "Nenhuma publicacao")
            if latest
            else "Nenhuma publicacao",
            styles["Heading2"],
        ),
    ]
    if latest:
        story.append(
            Paragraph(
                f"Periodo: {latest.get('period_start') or '—'} a "
                f"{latest.get('period_end') or '—'}",
                styles["Muted"],
            )
        )

    story += [
        Spacer(1, 16),
        Paragraph(
            "Todos os dados deste relatorio sao ficticios e controlados para "
            "apresentacao. Na versao final, serao substituidos pelos dados "
            "oficiais da APETIT.",
            styles["Muted"],
        ),
    ]

    def _footer(canvas, _doc):
        canvas.saveState()
        canvas.setFont("Helvetica", 7)
        canvas.setFillColor(colors.HexColor("#77777F"))
        canvas.drawString(14 * mm, 8 * mm, "APETIT · Relatorio Executivo de Demonstracao")
        canvas.drawRightString(
            A4[0] - 14 * mm,
            8 * mm,
            f"Pagina {canvas.getPageNumber()}",
        )
        canvas.restoreState()

    doc.build(story, onFirstPage=_footer, onLaterPages=_footer)
    return buffer.getvalue()


@router.get("/api/admin/overview.pdf", tags=["admin-overview"])
def admin_overview_pdf(
    x_apetit_admin_key: str | None = Header(default=None),
) -> StreamingResponse:
    payload = admin_overview(x_apetit_admin_key)
    pdf_bytes = _report_pdf(payload)
    filename = f"APETIT-Relatorio-Executivo-{date.today().isoformat()}.pdf"
    return StreamingResponse(
        BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
