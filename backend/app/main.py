from fastapi import FastAPI, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from app.api.auth import router as auth_router
from app.api.admin_overview import router as admin_overview_router
from app.api.admin_users import router as admin_users_router
from app.api.feedback import router as feedback_router
from app.api.meals import router as meals_router
from app.api.menus import router as menus_router
from app.api.prescriptions import router as prescriptions_router
from app.api.profile import router as profile_router
from app.api.technical_sheets import router as technical_sheets_router
from app.settings import settings

app = FastAPI(
    title="APETIT API",
    version="0.1.0",
    description="API central do APETIT-APP.",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(admin_overview_router)
app.include_router(admin_users_router)
app.include_router(profile_router)
app.include_router(menus_router)
app.include_router(feedback_router)
app.include_router(prescriptions_router)
app.include_router(meals_router)
app.include_router(technical_sheets_router)


EMPLOYEE_APP_HTML = """<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <title>APETIT Funcionário</title>
  <meta name="theme-color" content="#07090B" />
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; min-height: 100vh; font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #07090B; color: #fff; display: flex; justify-content: center; padding: 18px; }
    .phone { width: min(430px, 100%); min-height: calc(100vh - 36px); border-radius: 38px; background: linear-gradient(180deg, #151820, #090A0D); box-shadow: 0 30px 80px rgba(0,0,0,.55), inset 0 0 0 1px rgba(255,255,255,.08); overflow: hidden; position: relative; }
    .hero { padding: 34px 24px 16px; }
    .brand { display: flex; gap: 12px; align-items: center; }
    .logo { width: 54px; height: 54px; border-radius: 18px; background: #ED004B; display: grid; place-items: center; font-weight: 900; font-size: 29px; }
    .brand small { color: #99A0AA; display: block; }
    .eyebrow { margin-top: 34px; color: #ED004B; font-size: 12px; font-weight: 900; letter-spacing: .22em; }
    h1 { font-size: 38px; line-height: 1.02; margin: 12px 0 10px; }
    p { color: #C8CBD3; line-height: 1.55; }
    .card { margin: 16px 18px 0; border-radius: 26px; background: rgba(255,255,255,.07); padding: 18px; border: 1px solid rgba(255,255,255,.08); }
    .meal { display: flex; gap: 14px; align-items: center; }
    .plate { width: 84px; height: 84px; border-radius: 24px; background: radial-gradient(circle at 35% 35%, #FFB45E, #D85632 35%, #20252B 36%, #20252B 100%); box-shadow: inset 0 0 0 9px #303842; flex: 0 0 auto; }
    .meal h2 { font-size: 22px; margin: 0 0 5px; }
    .meal p { margin: 0; color: #AEB4BF; }
    .macros { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-top: 16px; }
    .macro { border-radius: 18px; background: rgba(255,255,255,.06); padding: 14px 10px; }
    .macro strong { font-size: 18px; display: block; }
    .macro span { color: #AEB4BF; font-size: 12px; }
    .feedback { display: flex; align-items: center; justify-content: space-between; }
    .emoji { font-size: 30px; }
    .actions { display: grid; gap: 10px; margin: 20px 18px; }
    .btn { border: 0; border-radius: 20px; padding: 17px; font-weight: 900; font-size: 15px; }
    .primary { background: #ED004B; color: #fff; box-shadow: 0 18px 45px rgba(237,0,75,.35); }
    .secondary { background: #20252C; color: #fff; }
    .install { margin: 0 18px 86px; color: #ABB2BD; font-size: 13px; }
    .dock { position: absolute; left: 22px; right: 22px; bottom: 22px; border-radius: 28px; background: rgba(255,255,255,.08); display: flex; justify-content: space-around; padding: 14px 10px; color: #ED004B; font-size: 20px; }
  </style>
</head>
<body>
  <main class="phone">
    <section class="hero">
      <div class="brand"><div class="logo">A</div><div><strong>APETIT</strong><small>Funcionário</small></div></div>
      <div class="eyebrow">REFEITÓRIO DIGITAL</div>
      <h1>Seu almoço de hoje, no celular.</h1>
      <p>Consulte o cardápio, acompanhe recomendações nutricionais e envie sua satisfação após a refeição.</p>
    </section>
    <section class="card meal"><div class="plate"></div><div><h2>Unidade Copel</h2><p>Cardápio disponível para teste</p></div></section>
    <section class="card"><strong>Recomendação personalizada</strong><div class="macros"><div class="macro"><strong>620</strong><span>kcal</span></div><div class="macro"><strong>34g</strong><span>proteína</span></div><div class="macro"><strong>82g</strong><span>carboidratos</span></div></div></section>
    <section class="card feedback"><div><strong>Satisfação</strong><p style="margin:4px 0 0;color:#AEB4BF">Avalie a experiência no refeitório</p></div><div><span class="emoji">😄</span><span class="emoji">🙂</span></div></section>
    <div class="actions"><button class="btn primary">Testar experiência</button><button class="btn secondary">Adicionar à tela inicial</button></div>
    <p class="install">Demonstração web do app do funcionário. No celular, abra pelo QR Code e use “Adicionar à Tela de Início” para testar como aplicativo.</p>
    <nav class="dock">🍽️ 📊 ♡ 👤</nav>
  </main>
</body>
</html>"""


@app.get("/funcionario", tags=["demo"], response_class=HTMLResponse)
def employee_app_demo() -> str:
    return EMPLOYEE_APP_HTML


@app.get("/app-funcionario", tags=["demo"], response_class=HTMLResponse)
def employee_app_demo_alias() -> str:
    return EMPLOYEE_APP_HTML


@app.get("/api/health", tags=["system"])
def health() -> dict[str, str]:
    return {"status": "ok", "environment": settings.environment}


@app.get("/api/readiness", tags=["system"])
def readiness(response: Response) -> dict:
    payload = settings.readiness()
    if payload["status"] != "ready":
        response.status_code = 503
    return payload
