import { useMemo, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native'
import {
  evaluatePlate,
  getMealHistory,
  getMealProgress,
  getPublishedMenu,
  getRecommendation,
  MealHistory,
  MealProgress,
  PlateEvaluation,
  PublishedMenu,
  Recommendation,
  registerMeal,
  registerSelectedMeal,
  submitFeedback,
} from './api'
import { DEMO_PERSON, DEMO_UNITS } from './demo'

type Screen = 'home' | 'menu' | 'recommendation' | 'builder' | 'feedback' | 'done' | 'progress'
type SelectedMap = Record<string, number>

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${Math.round(value)}${suffix}`
const shortDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))

export default function DemoApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [unitId, setUnitId] = useState(DEMO_UNITS[0].id)
  const [menu, setMenu] = useState<PublishedMenu | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [plate, setPlate] = useState<PlateEvaluation | null>(null)
  const [selected, setSelected] = useState<SelectedMap>({})
  const [history, setHistory] = useState<MealHistory | null>(null)
  const [progress, setProgress] = useState<MealProgress | null>(null)
  const [foodRating, setFoodRating] = useState(5)
  const [serviceRating, setServiceRating] = useState(5)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const unit = useMemo(() => DEMO_UNITS.find((item) => item.id === unitId) ?? DEMO_UNITS[0], [unitId])
  const selectedCount = Object.values(selected).filter((quantity) => quantity > 0).length

  async function ensureMenu() {
    if (menu?.unit_id === unitId && menu.service_date === today()) return menu
    const loaded = await getPublishedMenu({ unitId, serviceDate: today() })
    setMenu(loaded)
    return loaded
  }

  async function openMenu() {
    setBusy(true); setError('')
    try { await ensureMenu(); setScreen('menu') }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar o cardápio.') }
    finally { setBusy(false) }
  }

  async function openRecommendation() {
    setBusy(true); setError('')
    try {
      const response = await getRecommendation({ personId: DEMO_PERSON.id, unitId, serviceDate: today() })
      setRecommendation(response)
      setScreen('recommendation')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível montar sua recomendação.') }
    finally { setBusy(false) }
  }

  async function openBuilder(fromRecommendation = false) {
    setBusy(true); setError('')
    try {
      await ensureMenu()
      if (fromRecommendation && recommendation?.status === 'recommended') {
        setSelected(Object.fromEntries(recommendation.items.map((item) => [item.menu_item_id, 1])))
      } else {
        setSelected({})
      }
      setPlate(null)
      setScreen('builder')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível abrir o montador.') }
    finally { setBusy(false) }
  }

  function setQuantity(itemId: string, quantity: number) {
    setSelected((current) => {
      const next = { ...current }
      if (quantity <= 0) delete next[itemId]
      else next[itemId] = Math.min(quantity, 3)
      return next
    })
    setPlate(null)
  }

  async function evaluateCurrentPlate() {
    const selections = Object.entries(selected).filter(([, quantity]) => quantity > 0)
    if (!selections.length) { setError('Selecione pelo menos um item para avaliar o prato.'); return }
    setBusy(true); setError('')
    try {
      setPlate(await evaluatePlate({
        personId: DEMO_PERSON.id,
        unitId,
        serviceDate: today(),
        selections: selections.map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      }))
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível avaliar o prato.') }
    finally { setBusy(false) }
  }

  async function saveManualPlate() {
    if (!plate || plate.status === 'blocked' || plate.status === 'insufficient_data') return
    setBusy(true); setError('')
    try {
      await registerSelectedMeal({
        personId: DEMO_PERSON.id,
        serviceDate: today(),
        selections: Object.entries(selected).filter(([, q]) => q > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      })
      setScreen('feedback')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível registrar seu prato.') }
    finally { setBusy(false) }
  }

  async function openProgress() {
    setBusy(true); setError('')
    try {
      const [progressData, historyData] = await Promise.all([getMealProgress(DEMO_PERSON.id), getMealHistory(DEMO_PERSON.id)])
      setProgress(progressData); setHistory(historyData); setScreen('progress')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar seu progresso.') }
    finally { setBusy(false) }
  }

  async function saveRecommendedMeal() {
    if (!recommendation) return
    setBusy(true); setError('')
    try { await registerMeal({ personId: DEMO_PERSON.id, serviceDate: today(), recommendation }); setScreen('feedback') }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível registrar a refeição.') }
    finally { setBusy(false) }
  }

  function toggleTag(tag: string) {
    setTags((current) => current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag])
  }

  async function sendFeedback() {
    setBusy(true); setError('')
    try {
      await submitFeedback({
        personId: DEMO_PERSON.id,
        unitId: unit.id,
        restaurantId: unit.restaurantId,
        mealDate: today(),
        foodRating,
        serviceRating,
        tags,
        comment,
      })
      setScreen('done')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar sua avaliação.') }
    finally { setBusy(false) }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}><View><Text style={styles.brand}>APETIT</Text><Text style={styles.hello}>Olá, Mariana</Text></View><View style={styles.avatar}><Text style={styles.avatarText}>M</Text></View></View>
      <ScrollView contentContainerStyle={styles.content}>
        {screen !== 'home' && screen !== 'done' && <Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ Início</Text></Pressable>}

        {screen === 'home' && <>
          <View style={styles.hero}><Text style={styles.eyebrow}>ALIMENTAÇÃO INTELIGENTE</Text><Text style={styles.heroTitle}>Seu almoço, alinhado à sua meta.</Text><Text style={styles.heroText}>Receba uma sugestão ou monte seu próprio prato com o cardápio disponível.</Text><Pressable style={styles.primary} onPress={openRecommendation}><Text style={styles.primaryText}>Ver meu almoço de hoje</Text></Pressable></View>
          <Text style={styles.sectionTitle}>Unidade da demonstração</Text>
          <View style={styles.unitRow}>{DEMO_UNITS.map((item) => <Pressable key={item.id} style={[styles.chip, unitId === item.id && styles.chipActive]} onPress={() => { setUnitId(item.id); setMenu(null) }}><Text style={[styles.chipText, unitId === item.id && styles.chipTextActive]}>{item.company}</Text></Pressable>)}</View>
          <Pressable style={styles.card} onPress={openMenu}><Text style={styles.cardTitle}>Cardápio de hoje</Text><Text style={styles.cardText}>Veja tudo o que está disponível no refeitório.</Text><Text style={styles.arrow}>›</Text></Pressable>
          <Pressable style={styles.card} onPress={() => openBuilder(false)}><Text style={styles.cardTitle}>Montar meu prato</Text><Text style={styles.cardText}>Escolha os itens e compare a combinação com sua meta.</Text><Text style={styles.arrow}>›</Text></Pressable>
          <Pressable style={styles.card} onPress={openProgress}><Text style={styles.cardTitle}>Meu progresso</Text><Text style={styles.cardText}>Acompanhe refeições, macros e aderência à sua meta.</Text><Text style={styles.arrow}>›</Text></Pressable>
          <View style={styles.privacy}><Text style={styles.privacyTitle}>Privacidade por padrão</Text><Text style={styles.privacyText}>Sua prescrição e seu histórico alimentar ficam privados. A empresa recebe apenas dados agregados.</Text></View>
        </>}

        {screen === 'menu' && <>
          <Text style={styles.pageTitle}>Cardápio de hoje</Text><Text style={styles.pageSub}>{unit.company} · almoço</Text>
          <View style={styles.listCard}>{menu?.items.map((item) => <View key={item.id} style={styles.menuRow}><View style={{flex:1}}><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'} · {fmt(item.kcal, ' kcal')}</Text></View><Text style={styles.category}>{item.category.replaceAll('_', ' ')}</Text></View>)}</View>
          <Pressable style={styles.primary} onPress={() => openBuilder(false)}><Text style={styles.primaryText}>Montar meu prato</Text></Pressable>
          <Pressable style={styles.secondary} onPress={openRecommendation}><Text style={styles.secondaryText}>Ver recomendação automática</Text></Pressable>
        </>}

        {screen === 'recommendation' && recommendation && <>
          <Text style={styles.pageTitle}>Seu almoço de hoje</Text><Text style={styles.pageSub}>{unit.company} · baseado na sua prescrição</Text>
          {recommendation.status === 'insufficient_data' ? <View style={styles.warning}><Text style={styles.warningTitle}>Ainda não dá para calcular com segurança</Text><Text style={styles.warningText}>{recommendation.message}</Text></View> : <>
            <View style={styles.listCard}>{recommendation.items.map((item) => <View key={item.menu_item_id} style={styles.recoRow}><View style={styles.dot}/><View><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuMeta}>{item.portion ?? 'Porção padrão'} · {fmt(item.kcal, ' kcal')}</Text></View></View>)}</View>
            <MacroGrid totals={recommendation.estimated_totals} />
            <Pressable style={styles.primary} onPress={saveRecommendedMeal}><Text style={styles.primaryText}>Comi este prato · registrar</Text></Pressable>
            <Pressable style={styles.secondary} onPress={() => openBuilder(true)}><Text style={styles.secondaryText}>Quero trocar itens</Text></Pressable>
            <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>
          </>}
        </>}

        {screen === 'builder' && <>
          <Text style={styles.pageTitle}>Monte seu prato</Text><Text style={styles.pageSub}>{unit.company} · selecione os itens e ajuste as porções</Text>
          <View style={styles.builderSummary}><Text style={styles.builderCount}>{selectedCount}</Text><Text style={styles.builderLabel}>itens selecionados</Text></View>
          <View style={styles.listCard}>{menu?.items.map((item) => {
            const quantity = selected[item.id] ?? 0
            return <View key={item.id} style={styles.builderRow}><View style={{flex:1}}><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'} · {fmt(item.kcal, ' kcal')}</Text></View><View style={styles.stepper}><Pressable style={styles.stepButton} onPress={() => setQuantity(item.id, quantity - 1)}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.quantity}>{quantity}</Text><Pressable style={styles.stepButton} onPress={() => setQuantity(item.id, quantity + 1)}><Text style={styles.stepText}>+</Text></Pressable></View></View>
          })}</View>
          <Pressable style={styles.primary} onPress={evaluateCurrentPlate}><Text style={styles.primaryText}>Avaliar meu prato</Text></Pressable>
          {plate && <View style={[styles.resultCard, plate.status === 'blocked' && styles.resultBlocked, plate.status === 'within_target' && styles.resultGood]}>
            <Text style={styles.resultTitle}>{plate.status === 'within_target' ? '✓ Próximo da sua meta' : plate.status === 'blocked' ? 'Atenção à segurança' : plate.status === 'insufficient_data' ? 'Dados insuficientes' : 'Seu prato pode melhorar'}</Text>
            <Text style={styles.resultText}>{plate.message}</Text>
            <MacroGrid totals={plate.estimated_totals} />
            {plate.status !== 'blocked' && plate.status !== 'insufficient_data' && <Pressable style={styles.primary} onPress={saveManualPlate}><Text style={styles.primaryText}>Registrar este prato</Text></Pressable>}
          </View>}
        </>}

        {screen === 'progress' && <>
          <Text style={styles.pageTitle}>Meu progresso</Text><Text style={styles.pageSub}>Últimos 7 dias · somente você vê estes dados</Text>
          <View style={styles.progressHero}><Text style={styles.progressEyebrow}>ADERÊNCIA À META</Text><Text style={styles.progressNumber}>{progress?.adherence_percent == null ? '—' : `${progress.adherence_percent}%`}</Text><Text style={styles.progressText}>{progress?.meal_days ?? 0} refeição(ões) registrada(s) · {progress?.adherent_days ?? 0} dentro da faixa de referência</Text></View>
          <Text style={styles.sectionTitle}>Semana</Text>
          <View style={styles.listCard}>{progress?.series.length ? progress.series.map((day) => <View key={day.date} style={styles.weekRow}><View><Text style={styles.weekDate}>{shortDate(day.date)}</Text><Text style={styles.menuMeta}>{fmt(day.totals.kcal, ' kcal')} · {fmt(day.totals.protein_g, ' g proteína')}</Text></View><Text style={day.within_target ? styles.okText : styles.neutralText}>{day.within_target ? 'Na meta' : 'Fora da faixa'}</Text></View>) : <Text style={styles.emptyText}>Registre refeições para começar a acompanhar sua evolução.</Text>}</View>
          <Text style={styles.sectionTitle}>Histórico</Text>
          <View style={styles.listCard}>{history?.meals.length ? history.meals.map((meal) => <View key={meal.meal_id} style={styles.historyBlock}><View style={styles.historyHeader}><Text style={styles.weekDate}>{shortDate(meal.meal_date)}</Text><Text style={styles.historyTotal}>{fmt(meal.totals.kcal, ' kcal')}</Text></View>{meal.items.map((item, index) => <Text key={`${meal.meal_id}-${index}`} style={styles.historyItem}>• {item.item_name} · {item.quantity} {item.unit ?? ''}</Text>)}</View>) : <Text style={styles.emptyText}>Ainda não há refeições registradas.</Text>}</View>
        </>}

        {screen === 'feedback' && <>
          <Text style={styles.pageTitle}>Como foi seu almoço?</Text><Text style={styles.pageSub}>Seu feedback ajuda a melhorar a experiência no refeitório.</Text>
          <Rating title="Comida" value={foodRating} onChange={setFoodRating} />
          <Rating title="Atendimento" value={serviceRating} onChange={setServiceRating} />
          <Text style={styles.fieldTitle}>O que podemos melhorar?</Text>
          <View style={styles.tags}>{['comida fria','poucas opções','acabou cedo','não tinha opção para mim','tempo de espera'].map((tag) => <Pressable key={tag} style={[styles.tag, tags.includes(tag) && styles.tagActive]} onPress={() => toggleTag(tag)}><Text style={[styles.tagText, tags.includes(tag) && styles.tagTextActive]}>{tag}</Text></Pressable>)}</View>
          <TextInput style={styles.input} placeholder="Comentário opcional" multiline value={comment} onChangeText={setComment} />
          <Pressable style={styles.primary} onPress={sendFeedback}><Text style={styles.primaryText}>Enviar avaliação</Text></Pressable>
        </>}

        {screen === 'done' && <View style={styles.done}><View style={styles.doneIcon}><Text style={styles.doneCheck}>✓</Text></View><Text style={styles.doneTitle}>Refeição registrada</Text><Text style={styles.doneText}>Sua refeição já entrou no histórico e sua avaliação será usada apenas de forma agregada.</Text><Pressable style={styles.primary} onPress={openProgress}><Text style={styles.primaryText}>Ver meu progresso</Text></Pressable><Pressable style={styles.secondary} onPress={() => setScreen('home')}><Text style={styles.secondaryText}>Voltar ao início</Text></Pressable></View>}

        {!!error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}
        {busy && <ActivityIndicator style={{ marginTop: 18 }} color="#151512" />}
      </ScrollView>
    </SafeAreaView>
  )
}

function MacroGrid({ totals }: { totals?: { kcal:number|null;protein_g:number|null;carbs_g:number|null;fat_g:number|null } }) {
  return <View style={styles.metrics}><Metric label="Energia" value={fmt(totals?.kcal, ' kcal')} /><Metric label="Proteína" value={fmt(totals?.protein_g, ' g')} /><Metric label="Carboidratos" value={fmt(totals?.carbs_g, ' g')} /><Metric label="Gorduras" value={fmt(totals?.fat_g, ' g')} /></View>
}
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
function Rating({ title, value, onChange }: { title:string;value:number;onChange:(value:number)=>void }) { return <View style={styles.ratingCard}><Text style={styles.fieldTitle}>{title}</Text><View style={styles.ratingRow}>{[1,2,3,4,5].map((n)=><Pressable key={n} style={[styles.rating,value===n&&styles.ratingActive]} onPress={()=>onChange(n)}><Text style={[styles.ratingText,value===n&&styles.ratingTextActive]}>{n}</Text></Pressable>)}</View></View> }

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F5F4F0'},header:{padding:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontSize:12,letterSpacing:3,fontWeight:'900',color:'#78746B'},hello:{fontSize:24,fontWeight:'900',color:'#171714',marginTop:4},avatar:{width:42,height:42,borderRadius:21,backgroundColor:'#171714',alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontWeight:'900'},content:{padding:18,paddingBottom:44},hero:{backgroundColor:'#171714',borderRadius:28,padding:24},eyebrow:{color:'#D5D1C7',fontSize:11,fontWeight:'800',letterSpacing:1.7},heroTitle:{color:'#fff',fontSize:32,lineHeight:36,fontWeight:'900',marginTop:12},heroText:{color:'#CCC9C0',fontSize:15,lineHeight:22,marginTop:12,marginBottom:22},primary:{backgroundColor:'#D8B248',minHeight:54,borderRadius:18,alignItems:'center',justifyContent:'center',paddingHorizontal:18,marginTop:14},primaryText:{fontWeight:'900',color:'#171714'},secondary:{minHeight:50,borderRadius:18,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:'#D7D1C5',marginTop:10},secondaryText:{fontWeight:'800',color:'#4D4942'},sectionTitle:{fontSize:18,fontWeight:'900',marginTop:26,marginBottom:12,color:'#171714'},unitRow:{flexDirection:'row',gap:8,flexWrap:'wrap'},chip:{backgroundColor:'#fff',borderWidth:1,borderColor:'#DDD9CF',paddingHorizontal:14,paddingVertical:10,borderRadius:999},chipActive:{backgroundColor:'#171714'},chipText:{fontWeight:'800',color:'#6C675E'},chipTextActive:{color:'#fff'},card:{backgroundColor:'#fff',borderRadius:22,padding:18,marginTop:14,borderWidth:1,borderColor:'#E6E2D8'},cardTitle:{fontSize:17,fontWeight:'900',color:'#171714'},cardText:{fontSize:13,color:'#777168',marginTop:5,maxWidth:'82%'},arrow:{position:'absolute',right:18,top:26,fontSize:28,color:'#A19A8D'},privacy:{backgroundColor:'#EAF3EC',borderRadius:20,padding:18,marginTop:14},privacyTitle:{fontWeight:'900',color:'#25432D'},privacyText:{fontSize:13,lineHeight:19,color:'#506755',marginTop:5},back:{fontSize:15,fontWeight:'800',color:'#6A655C',paddingVertical:8},pageTitle:{fontSize:30,fontWeight:'900',color:'#171714',marginTop:10},pageSub:{fontSize:14,color:'#777168',marginTop:7,marginBottom:18},listCard:{backgroundColor:'#fff',borderRadius:22,padding:16,borderWidth:1,borderColor:'#E6E2D8'},menuRow:{paddingVertical:13,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E7E2D8',flexDirection:'row',alignItems:'center',gap:10},menuName:{fontSize:16,fontWeight:'900',color:'#171714'},menuMeta:{fontSize:12,color:'#817B70',marginTop:3},category:{fontSize:11,color:'#A07E28',textTransform:'capitalize',fontWeight:'800'},recoRow:{flexDirection:'row',alignItems:'center',paddingVertical:11},dot:{width:10,height:10,borderRadius:5,backgroundColor:'#D8B248',marginRight:12},metrics:{backgroundColor:'#fff',borderRadius:22,padding:18,marginTop:14,flexDirection:'row',flexWrap:'wrap'},metric:{width:'50%',marginBottom:14},metricValue:{fontSize:21,fontWeight:'900',color:'#171714'},metricLabel:{fontSize:12,color:'#817B70',marginTop:2},disclaimer:{fontSize:11,lineHeight:17,color:'#898379',textAlign:'center',margin:16},warning:{backgroundColor:'#FFF4D1',borderRadius:20,padding:18},warningTitle:{fontWeight:'900',color:'#5B4714'},warningText:{fontSize:13,lineHeight:19,color:'#766229',marginTop:6},builderSummary:{backgroundColor:'#171714',borderRadius:20,padding:18,marginBottom:14,flexDirection:'row',alignItems:'baseline',gap:8},builderCount:{fontSize:30,fontWeight:'900',color:'#D8B248'},builderLabel:{color:'#DDD8CD',fontWeight:'700'},builderRow:{paddingVertical:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E7E2D8',flexDirection:'row',alignItems:'center',gap:12},stepper:{flexDirection:'row',alignItems:'center',gap:8},stepButton:{width:34,height:34,borderRadius:12,backgroundColor:'#EEEAE2',alignItems:'center',justifyContent:'center'},stepText:{fontSize:22,fontWeight:'900'},quantity:{minWidth:18,textAlign:'center',fontWeight:'900'},resultCard:{backgroundColor:'#FFF4D1',borderRadius:22,padding:18,marginTop:16},resultGood:{backgroundColor:'#EAF3EC'},resultBlocked:{backgroundColor:'#FFE7E2'},resultTitle:{fontSize:18,fontWeight:'900',color:'#171714'},resultText:{fontSize:13,lineHeight:19,color:'#625D54',marginTop:6},progressHero:{backgroundColor:'#171714',borderRadius:26,padding:24},progressEyebrow:{color:'#CFCABE',fontSize:11,letterSpacing:1.5,fontWeight:'800'},progressNumber:{color:'#D8B248',fontSize:54,fontWeight:'900',marginTop:8},progressText:{color:'#DDD8CD',fontSize:13,lineHeight:19},weekRow:{paddingVertical:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E7E2D8'},weekDate:{fontSize:15,fontWeight:'900'},okText:{fontSize:12,fontWeight:'900',color:'#337448'},neutralText:{fontSize:12,fontWeight:'900',color:'#9A751C'},historyBlock:{paddingVertical:13,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E7E2D8'},historyHeader:{flexDirection:'row',justifyContent:'space-between'},historyTotal:{fontWeight:'900'},historyItem:{fontSize:12,color:'#716B61',marginTop:5},emptyText:{fontSize:13,color:'#817B70',paddingVertical:8},ratingCard:{backgroundColor:'#fff',borderRadius:20,padding:18,marginBottom:12},fieldTitle:{fontSize:15,fontWeight:'900',color:'#171714',marginBottom:10},ratingRow:{flexDirection:'row',gap:9},rating:{width:45,height:45,borderRadius:14,backgroundColor:'#F0EEE8',alignItems:'center',justifyContent:'center'},ratingActive:{backgroundColor:'#171714'},ratingText:{fontWeight:'900',color:'#6C675E'},ratingTextActive:{color:'#fff'},tags:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},tag:{paddingHorizontal:12,paddingVertical:9,borderRadius:999,backgroundColor:'#fff',borderWidth:1,borderColor:'#DED9CE'},tagActive:{backgroundColor:'#171714'},tagText:{fontSize:12,color:'#6D675C'},tagTextActive:{color:'#fff'},input:{backgroundColor:'#fff',borderRadius:18,minHeight:100,padding:14,textAlignVertical:'top',borderWidth:1,borderColor:'#E3DED4'},done:{paddingTop:70,alignItems:'center'},doneIcon:{width:72,height:72,borderRadius:36,backgroundColor:'#D8B248',alignItems:'center',justifyContent:'center'},doneCheck:{fontSize:34,fontWeight:'900'},doneTitle:{fontSize:28,fontWeight:'900',color:'#171714',marginTop:18},doneText:{fontSize:14,lineHeight:21,color:'#706A61',textAlign:'center',marginTop:10,marginBottom:10},error:{backgroundColor:'#FFE6E3',padding:14,borderRadius:16,marginTop:16},errorText:{color:'#8C2C22',fontSize:13}
})
