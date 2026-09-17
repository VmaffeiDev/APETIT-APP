import { useMemo, useState } from 'react'
import * as DocumentPicker from 'expo-document-picker'
import { StatusBar } from 'expo-status-bar'
import {
  ActivityIndicator,
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import {
  confirmPrescription,
  getPublishedMenu,
  getRecommendation,
  PrescriptionPreview,
  PublishedMenu,
  Recommendation,
  uploadPrescription,
} from './src/api'
import { DEMO_PERSON, DEMO_UNITS } from './src/demo'

type Screen = 'home' | 'prescription' | 'review' | 'menu' | 'recommendation'

const categoryLabels: Record<string, string> = {
  prato_principal: 'Prato principal',
  arroz: 'Arroz',
  feijao: 'Feijão',
  salada: 'Salada',
  guarnicao: 'Guarnição',
  sobremesa: 'Sobremesa',
}

function formatNumber(value: number | null | undefined, suffix = '') {
  if (value === null || value === undefined) return '—'
  return `${Math.round(value)}${suffix}`
}

export default function App() {
  const [screen, setScreen] = useState<Screen>('home')
  const [unitId, setUnitId] = useState(DEMO_UNITS[0].id)
  const [preview, setPreview] = useState<PrescriptionPreview | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [menu, setMenu] = useState<PublishedMenu | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const selectedUnit = useMemo(() => DEMO_UNITS.find((unit) => unit.id === unitId) ?? DEMO_UNITS[0], [unitId])

  async function choosePrescription() {
    setError('')
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'text/plain', 'image/*'],
      copyToCacheDirectory: true,
      multiple: false,
    })
    if (result.canceled) return

    const asset = result.assets[0]
    setBusy(true)
    try {
      const response = await uploadPrescription({
        personId: DEMO_PERSON.id,
        uri: asset.uri,
        name: asset.name,
        mimeType: asset.mimeType,
      })
      setPreview(response)
      setScreen('review')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível ler o documento.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmCurrentPrescription() {
    if (!preview?.meal) return
    setBusy(true)
    setError('')
    try {
      await confirmPrescription(preview)
      setScreen('home')
      Alert.alert('Controle nutricional confirmado', 'A partir de agora, a prescrição confirmada será usada para montar suas sugestões.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível confirmar a prescrição.')
    } finally {
      setBusy(false)
    }
  }

  async function loadRecommendation() {
    setBusy(true)
    setError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const response = await getRecommendation({ personId: DEMO_PERSON.id, unitId, serviceDate: today })
      setRecommendation(response)
      setScreen('recommendation')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível montar a recomendação.')
    } finally {
      setBusy(false)
    }
  }

  async function loadMenu() {
    setBusy(true)
    setError('')
    try {
      const today = new Date().toISOString().slice(0, 10)
      const response = await getPublishedMenu({ unitId, serviceDate: today })
      setMenu(response)
      setScreen('menu')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar o cardápio.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View>
          <Text style={styles.brand}>APETIT</Text>
          <Text style={styles.greeting}>Olá, {DEMO_PERSON.name.replace(' Demo', '')}</Text>
        </View>
        <View style={styles.avatar}><Text style={styles.avatarText}>M</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {screen === 'home' && (
          <>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>SEU ALMOÇO · HOJE</Text>
              <Text style={styles.heroTitle}>Coma de acordo com a sua meta.</Text>
              <Text style={styles.heroText}>Sua prescrição confirmada é cruzada com o cardápio disponível da unidade.</Text>
              <Pressable style={styles.primaryButton} onPress={loadRecommendation} disabled={busy}>
                <Text style={styles.primaryButtonText}>{busy ? 'Calculando...' : 'Ver meu almoço de hoje'}</Text>
              </Pressable>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Unidade da demonstração</Text>
              <Text style={styles.sectionHint}>Troque para simular outro cliente</Text>
            </View>
            <View style={styles.unitRow}>
              {DEMO_UNITS.map((unit) => (
                <Pressable key={unit.id} style={[styles.unitChip, unit.id === unitId && styles.unitChipActive]} onPress={() => setUnitId(unit.id)}>
                  <Text style={[styles.unitChipText, unit.id === unitId && styles.unitChipTextActive]}>{unit.company}</Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.unitCaption}>{selectedUnit.label} · ambiente fictício de apresentação</Text>

            <Pressable style={styles.controlCard} onPress={loadMenu}>
              <View style={styles.controlIcon}><Text style={styles.controlIconText}>☰</Text></View>
              <View style={styles.controlContent}>
                <Text style={styles.controlTitle}>Cardápio de hoje</Text>
                <Text style={styles.controlText}>Veja tudo o que está disponível no refeitório desta unidade.</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>

            <Pressable style={[styles.controlCard, styles.controlCardSpacing]} onPress={() => setScreen('prescription')}>
              <View style={styles.controlIcon}><Text style={styles.controlIconText}>⌁</Text></View>
              <View style={styles.controlContent}>
                <Text style={styles.controlTitle}>Meu controle nutricional</Text>
                <Text style={styles.controlText}>Envie ou atualize a orientação do seu nutricionista.</Text>
              </View>
              <Text style={styles.arrow}>›</Text>
            </Pressable>

            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>Privado para você</Text>
              <Text style={styles.infoText}>Sua prescrição e seu histórico alimentar não aparecem no painel da empresa. A gestão recebe apenas dados operacionais agregados.</Text>
            </View>
          </>
        )}

        {screen === 'prescription' && (
          <>
            <Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ Voltar</Text></Pressable>
            <Text style={styles.pageTitle}>Meu controle nutricional</Text>
            <Text style={styles.pageSubtitle}>Envie o documento fornecido pelo seu nutricionista. O app vai ler e pedir sua confirmação antes de usar qualquer valor.</Text>

            <View style={styles.uploadCard}>
              <View style={styles.uploadIcon}><Text style={styles.uploadIconText}>↑</Text></View>
              <Text style={styles.uploadTitle}>Adicionar prescrição</Text>
              <Text style={styles.uploadText}>PDF, TXT ou imagem. Documentos escaneados podem precisar de OCR.</Text>
              <Pressable style={styles.primaryButton} onPress={choosePrescription} disabled={busy}>
                <Text style={styles.primaryButtonText}>{busy ? 'Lendo documento...' : 'Escolher documento'}</Text>
              </Pressable>
            </View>

            <View style={styles.safetyCard}>
              <Text style={styles.safetyTitle}>Antes de usar</Text>
              <Text style={styles.safetyText}>Nenhum dado extraído automaticamente entra na recomendação até você confirmar o que foi lido.</Text>
            </View>
          </>
        )}

        {screen === 'review' && preview && (
          <>
            <Pressable onPress={() => setScreen('prescription')}><Text style={styles.back}>‹ Trocar documento</Text></Pressable>
            <Text style={styles.pageTitle}>Confira o que encontramos</Text>
            <Text style={styles.pageSubtitle}>{preview.message}</Text>

            {preview.requires_ocr || !preview.meal ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Precisamos ler melhor este documento</Text>
                <Text style={styles.warningText}>O arquivo parece ser uma imagem ou PDF escaneado. Ele não será usado até passar pelo OCR e por uma nova confirmação.</Text>
              </View>
            ) : (
              <>
                <View style={styles.targetCard}>
                  <Text style={styles.targetLabel}>ALMOÇO</Text>
                  <View style={styles.targetGrid}>
                    <Metric label="Energia" value={formatNumber(preview.meal.target.kcal, ' kcal')} />
                    <Metric label="Proteína" value={formatNumber(preview.meal.target.protein_g, ' g')} />
                    <Metric label="Carboidrato" value={formatNumber(preview.meal.target.carbs_g, ' g')} />
                    <Metric label="Gordura" value={formatNumber(preview.meal.target.fat_g, ' g')} />
                  </View>
                </View>

                {preview.meal.portions.length > 0 && (
                  <View style={styles.listCard}>
                    <Text style={styles.listTitle}>Porções identificadas</Text>
                    {preview.meal.portions.map((portion, index) => (
                      <View style={styles.listRow} key={`${portion.category}-${index}`}>
                        <Text style={styles.listMain}>{portion.category}</Text>
                        <Text style={styles.listValue}>{portion.quantity ?? '—'} {portion.unit ?? ''}</Text>
                      </View>
                    ))}
                  </View>
                )}

                <View style={styles.warningCard}>
                  <Text style={styles.warningTitle}>Confirme com atenção</Text>
                  <Text style={styles.warningText}>Verifique principalmente números e unidades. Ex.: 180 g não pode ser confundido com 80 g.</Text>
                </View>

                <Pressable style={styles.primaryButton} onPress={confirmCurrentPrescription} disabled={busy}>
                  <Text style={styles.primaryButtonText}>{busy ? 'Confirmando...' : 'Está correto · confirmar'}</Text>
                </Pressable>
              </>
            )}
          </>
        )}

        {screen === 'menu' && menu && (
          <>
            <Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ Início</Text></Pressable>
            <Text style={styles.pageTitle}>Cardápio de hoje</Text>
            <Text style={styles.pageSubtitle}>{selectedUnit.company} · {menu.items.length} opções disponíveis no almoço</Text>

            {menu.items.length === 0 ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Cardápio ainda não publicado</Text>
                <Text style={styles.warningText}>A operação ainda não publicou itens para esta unidade e data.</Text>
              </View>
            ) : (
              <View style={styles.menuCard}>
                {menu.items.map((item) => (
                  <View key={item.id} style={styles.menuRow}>
                    <View style={styles.menuCategory}>
                      <Text style={styles.menuCategoryText}>{categoryLabels[item.category] ?? item.category}</Text>
                    </View>
                    <View style={styles.menuBody}>
                      <Text style={styles.menuName}>{item.name}</Text>
                      <Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'} · {item.kcal == null ? 'nutrição pendente' : formatNumber(item.kcal, ' kcal')}</Text>
                    </View>
                  </View>
                ))}
              </View>
            )}

            <Pressable style={styles.primaryButton} onPress={loadRecommendation} disabled={busy}>
              <Text style={styles.primaryButtonText}>{busy ? 'Calculando...' : 'Montar meu prato recomendado'}</Text>
            </Pressable>
          </>
        )}

        {screen === 'recommendation' && recommendation && (
          <>
            <Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ Início</Text></Pressable>
            <Text style={styles.pageTitle}>Seu almoço de hoje</Text>
            <Text style={styles.pageSubtitle}>{selectedUnit.company} · sugestão baseada no controle nutricional confirmado</Text>

            {recommendation.status === 'insufficient_data' ? (
              <View style={styles.warningCard}>
                <Text style={styles.warningTitle}>Ainda não dá para calcular com segurança</Text>
                <Text style={styles.warningText}>{recommendation.message}</Text>
              </View>
            ) : (
              <>
                <View style={styles.recommendBadge}>
                  <Text style={styles.recommendBadgeText}>✓ Recomendação personalizada com base na sua prescrição</Text>
                </View>
                <View style={styles.mealCard}>
                  {recommendation.items.map((item) => (
                    <View key={item.menu_item_id} style={styles.mealRow}>
                      <View style={styles.mealDot} />
                      <View style={styles.mealBody}>
                        <Text style={styles.mealName}>{item.name}</Text>
                        <Text style={styles.mealMeta}>{item.portion ?? 'Porção padrão'} · {formatNumber(item.kcal, ' kcal')}</Text>
                      </View>
                    </View>
                  ))}
                </View>

                <View style={styles.targetCard}>
                  <Text style={styles.targetLabel}>ESTIMATIVA DO PRATO</Text>
                  <View style={styles.targetGrid}>
                    <Metric label="Energia" value={formatNumber(recommendation.estimated_totals?.kcal, ' kcal')} />
                    <Metric label="Proteína" value={formatNumber(recommendation.estimated_totals?.protein_g, ' g')} />
                    <Metric label="Carboidrato" value={formatNumber(recommendation.estimated_totals?.carbs_g, ' g')} />
                    <Metric label="Gordura" value={formatNumber(recommendation.estimated_totals?.fat_g, ' g')} />
                  </View>
                </View>

                <View style={styles.goalCard}>
                  <Text style={styles.goalTitle}>Sua meta para o almoço</Text>
                  <Text style={styles.goalText}>{formatNumber(recommendation.target.kcal, ' kcal')} · {formatNumber(recommendation.target.protein_g, ' g proteína')} · {formatNumber(recommendation.target.carbs_g, ' g carboidratos')}</Text>
                </View>

                <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>
              </>
            )}

            {(recommendation.warnings.excluded_for_restriction.length > 0 || recommendation.warnings.uncertain_allergens.length > 0) && (
              <View style={styles.safetyCard}>
                <Text style={styles.safetyTitle}>Proteções aplicadas</Text>
                <Text style={styles.safetyText}>Itens incompatíveis ou com alergênico incerto relevante foram retirados da sugestão.</Text>
              </View>
            )}
          </>
        )}

        {!!error && <View style={styles.errorCard}><Text style={styles.errorText}>{error}</Text></View>}
        {busy && <ActivityIndicator style={{ marginTop: 16 }} color="#111111" />}
      </ScrollView>
    </SafeAreaView>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View>
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#F5F4F0' },
  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { fontSize: 12, letterSpacing: 3, fontWeight: '800', color: '#77746C' },
  greeting: { fontSize: 24, fontWeight: '800', color: '#171714', marginTop: 4 },
  avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: '#171714', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontWeight: '800' },
  content: { paddingHorizontal: 18, paddingBottom: 44 },
  hero: { backgroundColor: '#171714', borderRadius: 28, padding: 24, marginTop: 6 },
  eyebrow: { color: '#C9C7BC', fontSize: 11, letterSpacing: 1.7, fontWeight: '800' },
  heroTitle: { color: '#FFFFFF', fontSize: 32, lineHeight: 36, fontWeight: '800', marginTop: 12 },
  heroText: { color: '#CFCEC8', fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 22 },
  primaryButton: { backgroundColor: '#E8FF61', minHeight: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
  primaryButtonText: { color: '#171714', fontWeight: '800', fontSize: 15 },
  sectionHeader: { marginTop: 26, marginBottom: 12 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#171714' },
  sectionHint: { fontSize: 13, color: '#77746C', marginTop: 3 },
  unitRow: { flexDirection: 'row', gap: 8 },
  unitChip: { borderWidth: 1, borderColor: '#D8D6CF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, backgroundColor: '#FFFFFF' },
  unitChipActive: { backgroundColor: '#171714', borderColor: '#171714' },
  unitChipText: { color: '#5D5A53', fontWeight: '700', fontSize: 13 },
  unitChipTextActive: { color: '#FFFFFF' },
  unitCaption: { color: '#89867E', fontSize: 12, marginTop: 9, marginBottom: 20 },
  controlCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: '#E7E4DC' },
  controlCardSpacing: { marginTop: 12 },
  controlIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#F1F6CB', alignItems: 'center', justifyContent: 'center' },
  controlIconText: { fontSize: 22, color: '#171714' },
  controlContent: { flex: 1, paddingHorizontal: 14 },
  controlTitle: { fontSize: 16, fontWeight: '800', color: '#171714' },
  controlText: { fontSize: 13, color: '#77746C', lineHeight: 18, marginTop: 4 },
  arrow: { fontSize: 28, color: '#9A978E' },
  infoCard: { marginTop: 14, backgroundColor: '#EBF4EE', borderRadius: 20, padding: 18 },
  infoTitle: { fontSize: 14, fontWeight: '800', color: '#23402C' },
  infoText: { fontSize: 13, lineHeight: 19, color: '#486153', marginTop: 6 },
  back: { color: '#69665F', fontSize: 15, fontWeight: '700', paddingVertical: 8 },
  pageTitle: { color: '#171714', fontSize: 30, lineHeight: 34, fontWeight: '800', marginTop: 10 },
  pageSubtitle: { color: '#706D65', fontSize: 15, lineHeight: 22, marginTop: 10, marginBottom: 20 },
  uploadCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E5E2DA', padding: 22, alignItems: 'center' },
  uploadIcon: { width: 58, height: 58, borderRadius: 18, backgroundColor: '#F1F6CB', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  uploadIconText: { fontSize: 28, fontWeight: '700' },
  uploadTitle: { fontSize: 19, fontWeight: '800', color: '#171714' },
  uploadText: { fontSize: 13, lineHeight: 19, color: '#77746C', textAlign: 'center', marginVertical: 10, marginBottom: 18 },
  safetyCard: { backgroundColor: '#EAF3EC', borderRadius: 20, padding: 18, marginTop: 16 },
  safetyTitle: { color: '#24442D', fontSize: 14, fontWeight: '800' },
  safetyText: { color: '#506755', fontSize: 13, lineHeight: 19, marginTop: 6 },
  warningCard: { backgroundColor: '#FFF6D8', borderRadius: 20, padding: 18, marginBottom: 16 },
  warningTitle: { color: '#5A4510', fontSize: 15, fontWeight: '800' },
  warningText: { color: '#756124', fontSize: 13, lineHeight: 19, marginTop: 6 },
  targetCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#E7E4DC', marginBottom: 14 },
  targetLabel: { color: '#8B887F', fontSize: 11, letterSpacing: 1.5, fontWeight: '800', marginBottom: 14 },
  targetGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  metric: { width: '50%', marginBottom: 14 },
  metricValue: { color: '#171714', fontSize: 22, fontWeight: '800' },
  metricLabel: { color: '#858178', fontSize: 12, marginTop: 2 },
  listCard: { backgroundColor: '#FFFFFF', borderRadius: 22, padding: 18, borderWidth: 1, borderColor: '#E7E4DC', marginBottom: 14 },
  listTitle: { fontSize: 15, fontWeight: '800', color: '#171714', marginBottom: 8 },
  listRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8E5DD' },
  listMain: { color: '#37352F', fontSize: 14, textTransform: 'capitalize' },
  listValue: { color: '#171714', fontSize: 14, fontWeight: '800' },
  menuCard: { backgroundColor: '#FFFFFF', borderRadius: 24, borderWidth: 1, borderColor: '#E7E4DC', overflow: 'hidden', marginBottom: 18 },
  menuRow: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7E4DC' },
  menuCategory: { alignSelf: 'flex-start', backgroundColor: '#F1F6CB', paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, marginBottom: 7 },
  menuCategoryText: { color: '#596200', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  menuBody: { flex: 1 },
  menuName: { color: '#171714', fontSize: 16, fontWeight: '800' },
  menuMeta: { color: '#817E75', fontSize: 12, marginTop: 4 },
  recommendBadge: { backgroundColor: '#EAF3EC', borderRadius: 15, padding: 13, marginBottom: 12 },
  recommendBadgeText: { color: '#285236', fontSize: 12, lineHeight: 17, fontWeight: '800' },
  mealCard: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 18, borderWidth: 1, borderColor: '#E7E4DC', marginBottom: 14 },
  mealRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11 },
  mealDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#B9D400', marginRight: 12 },
  mealBody: { flex: 1 },
  mealName: { fontSize: 16, fontWeight: '800', color: '#171714' },
  mealMeta: { color: '#817E75', fontSize: 12, marginTop: 3 },
  goalCard: { backgroundColor: '#171714', borderRadius: 20, padding: 18, marginBottom: 14 },
  goalTitle: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  goalText: { color: '#D7D5CF', fontSize: 13, lineHeight: 19, marginTop: 6 },
  disclaimer: { color: '#8A877F', fontSize: 12, lineHeight: 18, textAlign: 'center', marginHorizontal: 12, marginTop: 4, marginBottom: 16 },
  errorCard: { backgroundColor: '#FFE6E3', padding: 14, borderRadius: 16, marginTop: 16 },
  errorText: { color: '#8C2C22', fontSize: 13, lineHeight: 18 },
})
