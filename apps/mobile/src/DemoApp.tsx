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
import { colors, radius, shadow } from './theme'

type Screen = 'home' | 'menu' | 'recommendation' | 'builder' | 'feedback' | 'done' | 'progress'
type SelectedMap = Record<string, number>

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${Math.round(value)}${suffix}`
const shortDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(`${value}T12:00:00`))
const weekday = () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

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

  function goHome() { setError(''); setScreen('home') }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <Pressable onPress={goHome} style={styles.topIcon}><Text style={styles.topIconText}>{screen === 'home' ? 'ⓘ' : '‹'}</Text></Pressable>
        <View style={styles.topCenter}><Text style={styles.brand}>Apetit</Text><Text style={styles.date}>{weekday()}</Text></View>
        <Pressable style={styles.topIcon}><Text style={styles.topIconText}>◉</Text></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {screen === 'home' && <Home
          unitId={unitId}
          setUnitId={(id) => { setUnitId(id); setMenu(null) }}
          onMenu={openMenu}
          onRecommendation={openRecommendation}
          onBuilder={() => openBuilder(false)}
          onProgress={openProgress}
        />}

        {screen === 'menu' && <>
          <Text style={styles.kicker}>CARDÁPIO DO DIA</Text>
          <Text style={styles.pageTitle}>Cardápio de hoje</Text>
          <Text style={styles.pageSub}>{unit.company} · almoço</Text>
          <View style={styles.filterRow}><Filter active label="Todos"/><Filter label="Proteínas"/><Filter label="Carboidratos"/><Filter label="Saladas"/></View>
          <View style={styles.listCard}>{menu?.items.map((item, index) => <View key={item.id} style={styles.menuRow}>
            <View style={styles.foodThumb}><Text style={styles.foodThumbText}>{['🍖','🥚','🍝','🍚','🫘','🥗'][index % 6]}</Text></View>
            <View style={styles.flex}><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'} · {fmt(item.kcal, ' kcal')}</Text></View>
            <StatusPill index={index}/><Text style={styles.chevron}>›</Text>
          </View>)}</View>
          <Pressable style={styles.primary} onPress={() => openBuilder(false)}><Text style={styles.primaryText}>🍴  Montar meu prato</Text></Pressable>
          <Pressable style={styles.secondary} onPress={openRecommendation}><Text style={styles.secondaryText}>Ver recomendação automática</Text></Pressable>
        </>}

        {screen === 'recommendation' && recommendation && <>
          <Text style={styles.pageTitle}>Quanto pegar hoje</Text>
          <Text style={styles.pageSub}>Sugestão baseada na sua prescrição e no cardápio disponível.</Text>
          {recommendation.status === 'insufficient_data' ? <View style={styles.warning}><Text style={styles.warningTitle}>Ainda não dá para calcular com segurança</Text><Text style={styles.warningText}>{recommendation.message}</Text></View> : <>
            <View style={styles.suggestionCard}>
              <Text style={styles.suggestionLabel}>SEU PRATO SUGERIDO HOJE</Text>
              <View style={styles.suggestionMain}><View style={styles.plateMock}><Text style={styles.plateEmoji}>🍛</Text></View><View style={styles.flex}><Text style={styles.suggestionKcal}>{fmt(recommendation.estimated_totals?.kcal, ' kcal')}</Text><Text style={styles.suggestionProtein}>{fmt(recommendation.estimated_totals?.protein_g, ' g de proteína')}</Text><Text style={styles.goal}>◎  Objetivo · manter o equilíbrio</Text></View></View>
            </View>
            <Text style={styles.sectionLabel}>SUAS PORÇÕES</Text>
            <View style={styles.listCard}>{recommendation.items.map((item, index) => <View key={item.menu_item_id} style={styles.portionRow}><Text style={styles.portionName}>{item.name}</Text><View style={[styles.portionPill, index === recommendation.items.length - 1 && styles.greenPill]}><Text style={styles.portionPillText}>{item.portion ?? '1 porção'}</Text></View></View>)}</View>
            <View style={styles.estimate}><Text style={styles.estimateStrong}>Estimativa: {fmt(recommendation.estimated_totals?.kcal, ' kcal')} · {fmt(recommendation.estimated_totals?.protein_g, ' g de proteína')}</Text><Text style={styles.estimateText}>Essa sugestão considera seu objetivo e as opções disponíveis hoje.</Text></View>
            <Pressable style={styles.primary} onPress={saveRecommendedMeal}><Text style={styles.primaryText}>✓  Vou pegar isso — registrar</Text></Pressable>
            <Pressable style={styles.secondary} onPress={() => openBuilder(true)}><Text style={styles.secondaryText}>🍴  Montar do meu jeito</Text></Pressable>
            <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>
          </>}
        </>}

        {screen === 'builder' && <>
          <Text style={styles.pageTitle}>Montar meu prato</Text>
          <Text style={styles.pageSub}>Ajuste suas porções e confira como o prato se aproxima da sua meta.</Text>
          <View style={styles.builderSummary}><View><Text style={styles.builderCount}>{selectedCount}</Text><Text style={styles.builderLabel}>itens selecionados</Text></View><Text style={styles.builderIcon}>🍽️</Text></View>
          <View style={styles.listCard}>{menu?.items.map((item) => {
            const quantity = selected[item.id] ?? 0
            return <View key={item.id} style={styles.builderRow}><View style={styles.flex}><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'} · {fmt(item.kcal, ' kcal')}</Text></View><View style={styles.stepper}><Pressable style={styles.stepButton} onPress={() => setQuantity(item.id, quantity - 1)}><Text style={styles.stepText}>−</Text></Pressable><Text style={styles.quantity}>{quantity}</Text><Pressable style={styles.stepButton} onPress={() => setQuantity(item.id, quantity + 1)}><Text style={styles.stepText}>+</Text></Pressable></View></View>
          })}</View>
          <Pressable style={styles.primary} onPress={evaluateCurrentPlate}><Text style={styles.primaryText}>Avaliar meu prato</Text></Pressable>
          {plate && <View style={[styles.resultCard, plate.status === 'blocked' && styles.resultBlocked, plate.status === 'within_target' && styles.resultGood]}>
            <Text style={styles.resultTitle}>{plate.status === 'within_target' ? '✓ Próximo da sua meta' : plate.status === 'blocked' ? '⚠ Atenção à segurança' : plate.status === 'insufficient_data' ? 'Dados insuficientes' : 'Seu prato pode melhorar'}</Text>
            <Text style={styles.resultText}>{plate.message}</Text>
            <MacroGrid totals={plate.estimated_totals} />
            {plate.status !== 'blocked' && plate.status !== 'insufficient_data' && <Pressable style={styles.primary} onPress={saveManualPlate}><Text style={styles.primaryText}>Registrar este prato</Text></Pressable>}
          </View>}
        </>}

        {screen === 'progress' && <>
          <Text style={styles.pageTitle}>Meu progresso</Text><Text style={styles.pageSub}>Pequenas escolhas, grandes resultados.</Text>
          <View style={styles.pointsCard}><View style={styles.pointsRing}><Text style={styles.pointsNumber}>{progress?.adherent_days ?? 0}</Text></View><View style={styles.flex}><Text style={styles.pointsTitle}>pontos acumulados</Text><Text style={styles.pointsText}>Você está no caminho certo. Continue assim.</Text></View></View>
          <View style={styles.segment}><View style={styles.segmentActive}><Text style={styles.segmentActiveText}>Semana</Text></View><Text style={styles.segmentText}>Mês</Text><Text style={styles.segmentText}>Ano</Text></View>
          <View style={styles.chart}>{(progress?.series ?? []).slice(-5).map((day, i) => <View key={day.date} style={styles.barWrap}><Text style={styles.barValue}>{fmt(day.totals.kcal)}</Text><View style={[styles.bar, {height: 30 + Math.min(70, (day.totals.kcal ?? 0) / 12)}, i === 3 && styles.barYellow]}/><Text style={styles.barLabel}>{shortDate(day.date)}</Text></View>)}</View>
          <View style={styles.statGrid}><Stat icon="💪" value={`${progress?.adherent_days ?? 0}/${progress?.meal_days ?? 0}`} label="Dias na meta"/><Stat icon="🥗" value={`${progress?.meal_days ?? 0}`} label="Refeições registradas"/></View>
          <Text style={styles.sectionLabel}>HISTÓRICO RECENTE</Text>
          <View style={styles.listCard}>{history?.meals.length ? history.meals.slice(0,4).map((meal) => <View key={meal.meal_id} style={styles.historyBlock}><View style={styles.historyHeader}><Text style={styles.weekDate}>{shortDate(meal.meal_date)}</Text><Text style={styles.historyTotal}>{fmt(meal.totals.kcal, ' kcal')}</Text></View>{meal.items.slice(0,3).map((item, index) => <Text key={`${meal.meal_id}-${index}`} style={styles.historyItem}>✓ {item.item_name} · {item.quantity} {item.unit ?? ''}</Text>)}</View>) : <Text style={styles.emptyText}>Ainda não há refeições registradas.</Text>}</View>
        </>}

        {screen === 'feedback' && <>
          <Text style={styles.pageTitle}>Como foi o almoço de hoje?</Text><Text style={styles.pageSub}>Sua avaliação ajuda a Apetit a acompanhar a qualidade do refeitório.</Text>
          <View style={styles.feedbackQuestion}><Text style={styles.feedbackTitle}>A comida estava boa?</Text><Text style={styles.feedbackSub}>Escolha a opção que melhor representa sua experiência.</Text></View>
          <View style={styles.moodRow}><Mood active={foodRating >= 4} icon="☺" label="Boa" onPress={()=>setFoodRating(5)}/><Mood active={foodRating === 3} icon="—" label="Regular" onPress={()=>setFoodRating(3)}/><Mood danger active={foodRating <= 2} icon="☹" label="Ruim" onPress={()=>setFoodRating(1)}/></View>
          <Rating title="Atendimento" value={serviceRating} onChange={setServiceRating}/>
          <Text style={styles.fieldTitle}>O que mais influenciou sua avaliação?</Text>
          <View style={styles.tags}>{['sabor','temperatura','variedade','atendimento','outro'].map((tag) => <Pressable key={tag} style={[styles.tag, tags.includes(tag) && styles.tagActive]} onPress={() => toggleTag(tag)}><Text style={[styles.tagText, tags.includes(tag) && styles.tagTextActive]}>{tag}</Text></Pressable>)}</View>
          <TextInput style={styles.input} placeholder="Comentário opcional" placeholderTextColor={colors.muted2} multiline value={comment} onChangeText={setComment}/>
          <Pressable style={styles.primary} onPress={sendFeedback}><Text style={styles.primaryText}>Enviar avaliação</Text></Pressable>
        </>}

        {screen === 'done' && <View style={styles.done}><View style={styles.doneIcon}><Text style={styles.doneCheck}>✓</Text></View><Text style={styles.doneTitle}>Obrigado pela sua avaliação!</Text><Text style={styles.doneText}>Sua opinião nos ajuda a melhorar a cada dia.</Text><Pressable style={styles.primary} onPress={openProgress}><Text style={styles.primaryText}>Ver meu progresso</Text></Pressable><Pressable style={styles.secondary} onPress={goHome}><Text style={styles.secondaryText}>Voltar ao início</Text></Pressable></View>}

        {!!error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}
        {busy && <ActivityIndicator style={{ marginTop: 18 }} color={colors.red}/>} 
      </ScrollView>

      <BottomNav
        screen={screen}
        onHome={goHome}
        onMenu={openMenu}
        onPlate={()=>openBuilder(false)}
        onProgress={openProgress}
      />
    </SafeAreaView>
  )
}

function Home({ unitId, setUnitId, onMenu, onRecommendation, onBuilder, onProgress }: { unitId:string;setUnitId:(id:string)=>void;onMenu:()=>void;onRecommendation:()=>void;onBuilder:()=>void;onProgress:()=>void }) {
  return <>
    <Text style={styles.homeSubtitle}>Escolhas hoje, um amanhã melhor</Text>
    <View style={styles.achievementCard}><View style={styles.trophy}><Text style={styles.trophyText}>🏆</Text></View><View style={styles.flex}><Text style={styles.achievementTitle}>Minhas conquistas</Text><Text style={styles.achievementLine}>✓  Atingiu a meta de proteína do dia</Text><Text style={styles.achievementLine}>✓  Registrou a refeição</Text><Text style={styles.achievementLine}>✓  Incluiu salada ou fruta no prato</Text></View><View style={styles.scoreRing}><Text style={styles.score}>25</Text><Text style={styles.scoreLabel}>PONTOS</Text></View></View>
    <Pressable style={styles.heroAction} onPress={onBuilder}><Text style={styles.heroActionText}>🍴  Montar meu prato</Text><Text style={styles.heroActionArrow}>›</Text></Pressable>
    <Pressable style={styles.darkAction} onPress={onRecommendation}><Text style={styles.darkActionText}>🍛  Quanto pegar hoje</Text><Text style={styles.chevron}>›</Text></Pressable>
    <Text style={styles.quickTitle}>Ações rápidas</Text><Text style={styles.quickHint}>FACILITA O SEU DIA</Text>
    <View style={styles.quickGrid}><Pressable style={styles.quickCard} onPress={onMenu}><Text style={styles.quickIcon}>▣</Text><Text style={styles.quickText}>Cardápio</Text></Pressable><Pressable style={styles.quickCard} onPress={()=>{}}><Text style={styles.quickIcon}>☆</Text><Text style={styles.quickText}>Avaliar o refeitório</Text></Pressable></View>
    <Text style={styles.sectionLabel}>UNIDADE</Text>
    <View style={styles.unitRow}>{DEMO_UNITS.map((item)=><Pressable key={item.id} style={[styles.chip, unitId===item.id&&styles.chipActive]} onPress={()=>setUnitId(item.id)}><Text style={[styles.chipText,unitId===item.id&&styles.chipTextActive]}>{item.company}</Text></Pressable>)}</View>
    <Pressable style={styles.progressShortcut} onPress={onProgress}><Text style={styles.progressShortcutText}>Seu progresso da semana</Text><Text style={styles.progressShortcutValue}>Ver detalhes  ›</Text></Pressable>
  </>
}

function Filter({label,active=false}:{label:string;active?:boolean}) { return <View style={[styles.filter,active&&styles.filterActive]}><Text style={[styles.filterText,active&&styles.filterTextActive]}>{label}</Text></View> }
function StatusPill({index}:{index:number}) { const green=index===1||index===4||index===5; return <View style={[styles.statusPill,green&&styles.statusGreen]}><Text style={[styles.statusText,green&&styles.statusGreenText]}>{green?'Leve':'Moderado'}</Text></View> }
function Mood({icon,label,active,danger=false,onPress}:{icon:string;label:string;active:boolean;danger?:boolean;onPress:()=>void}) { return <Pressable onPress={onPress} style={[styles.mood,active&&styles.moodActive,danger&&active&&styles.moodDanger]}><Text style={[styles.moodIcon,active&&styles.moodIconActive]}>{icon}</Text><Text style={styles.moodLabel}>{label}</Text></Pressable> }
function MacroGrid({ totals }: { totals?: { kcal:number|null;protein_g:number|null;carbs_g:number|null;fat_g:number|null } }) { return <View style={styles.metrics}><Metric label="Energia" value={fmt(totals?.kcal,' kcal')}/><Metric label="Proteína" value={fmt(totals?.protein_g,' g')}/><Metric label="Carboidratos" value={fmt(totals?.carbs_g,' g')}/><Metric label="Gorduras" value={fmt(totals?.fat_g,' g')}/></View> }
function Metric({label,value}:{label:string;value:string}) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
function Stat({icon,value,label}:{icon:string;value:string;label:string}) { return <View style={styles.stat}><Text style={styles.statIcon}>{icon}</Text><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View> }
function Rating({title,value,onChange}:{title:string;value:number;onChange:(v:number)=>void}) { return <View style={styles.ratingCard}><Text style={styles.fieldTitle}>{title}</Text><View style={styles.ratingRow}>{[1,2,3,4,5].map(n=><Pressable key={n} style={[styles.rating,value===n&&styles.ratingActive]} onPress={()=>onChange(n)}><Text style={[styles.ratingText,value===n&&styles.ratingTextActive]}>{n}</Text></Pressable>)}</View></View> }
function BottomNav({screen,onHome,onMenu,onPlate,onProgress}:{screen:Screen;onHome:()=>void;onMenu:()=>void;onPlate:()=>void;onProgress:()=>void}) { const active=(key:string)=>screen===key||(key==='plate'&&(screen==='builder'||screen==='recommendation')); return <View style={styles.nav}><NavItem icon="⌂" label="Início" active={active('home')} onPress={onHome}/><NavItem icon="▣" label="Cardápio" active={active('menu')} onPress={onMenu}/><NavItem icon="🍴" label="Meu prato" active={active('plate')} onPress={onPlate}/><NavItem icon="▥" label="Progresso" active={active('progress')} onPress={onProgress}/><NavItem icon="○" label="Perfil" active={false} onPress={()=>{}}/></View> }
function NavItem({icon,label,active,onPress}:{icon:string;label:string;active:boolean;onPress:()=>void}) { return <Pressable style={styles.navItem} onPress={onPress}><Text style={[styles.navIcon,active&&styles.navActive]}>{icon}</Text><Text style={[styles.navLabel,active&&styles.navActive]}>{label}</Text>{active&&<View style={styles.navDot}/>}</Pressable> }

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},flex:{flex:1},topBar:{height:74,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:colors.borderSoft},topCenter:{alignItems:'center'},brand:{fontSize:19,fontWeight:'900',color:colors.text},date:{fontSize:10,color:colors.muted,marginTop:2,textTransform:'capitalize'},topIcon:{width:36,height:36,borderRadius:18,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},topIconText:{fontSize:20,color:colors.text},content:{padding:18,paddingBottom:110},homeSubtitle:{fontSize:13,color:colors.muted,marginBottom:14},achievementCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:15,flexDirection:'row',alignItems:'center',gap:12,...shadow},trophy:{width:42,height:42,borderRadius:13,backgroundColor:colors.red,alignItems:'center',justifyContent:'center'},trophyText:{fontSize:20},achievementTitle:{fontSize:15,fontWeight:'900',color:colors.text,marginBottom:8},achievementLine:{fontSize:11,color:'#D6DAE0',marginTop:3},scoreRing:{width:76,height:76,borderRadius:38,borderWidth:5,borderColor:colors.yellow,alignItems:'center',justifyContent:'center'},score:{fontSize:24,fontWeight:'900',color:colors.text},scoreLabel:{fontSize:8,fontWeight:'900',color:colors.muted,letterSpacing:1},heroAction:{minHeight:58,borderRadius:radius.md,backgroundColor:colors.yellow,marginTop:16,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},heroActionText:{fontSize:16,fontWeight:'900',color:'#111'},heroActionArrow:{fontSize:28,color:'#111'},darkAction:{minHeight:54,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,marginTop:10,paddingHorizontal:16,flexDirection:'row',alignItems:'center'},darkActionText:{fontSize:14,fontWeight:'800',color:colors.text,flex:1},quickTitle:{fontSize:16,fontWeight:'900',color:colors.text,marginTop:22},quickHint:{fontSize:9,letterSpacing:1.6,color:colors.muted2,marginTop:3},quickGrid:{flexDirection:'row',gap:10,marginTop:10},quickCard:{flex:1,minHeight:76,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,padding:13,justifyContent:'space-between'},quickIcon:{fontSize:22,color:colors.red},quickText:{fontSize:12,fontWeight:'800',color:colors.text},sectionLabel:{fontSize:10,fontWeight:'900',letterSpacing:1.4,color:colors.muted,marginTop:22,marginBottom:10},unitRow:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},chipActive:{backgroundColor:colors.red,borderColor:colors.red},chipText:{fontSize:11,fontWeight:'800',color:colors.muted},chipTextActive:{color:colors.white},progressShortcut:{marginTop:14,backgroundColor:colors.surface,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,padding:14,flexDirection:'row',justifyContent:'space-between'},progressShortcutText:{fontSize:12,fontWeight:'800',color:colors.text},progressShortcutValue:{fontSize:11,color:colors.muted},kicker:{fontSize:10,fontWeight:'900',letterSpacing:1.6,color:colors.muted,marginTop:2},pageTitle:{fontSize:30,fontWeight:'900',color:colors.text,marginTop:5},pageSub:{fontSize:13,lineHeight:19,color:colors.muted,marginTop:6,marginBottom:16},filterRow:{flexDirection:'row',gap:7,marginBottom:12},filter:{paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},filterActive:{backgroundColor:colors.red,borderColor:colors.red},filterText:{fontSize:10,fontWeight:'800',color:colors.muted},filterTextActive:{color:colors.white},listCard:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,overflow:'hidden'},menuRow:{minHeight:68,padding:10,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},foodThumb:{width:46,height:46,borderRadius:12,backgroundColor:colors.surfaceAlt,alignItems:'center',justifyContent:'center'},foodThumbText:{fontSize:24},menuName:{fontSize:14,fontWeight:'800',color:colors.text},menuMeta:{fontSize:10,color:colors.muted,marginTop:3},statusPill:{paddingHorizontal:8,paddingVertical:5,borderRadius:radius.pill,backgroundColor:colors.yellowSoft,borderWidth:1,borderColor:'#6C5B13'},statusGreen:{backgroundColor:colors.greenSoft,borderColor:'#206E4A'},statusText:{fontSize:9,fontWeight:'900',color:colors.yellow},statusGreenText:{color:colors.green},chevron:{fontSize:22,color:colors.muted2},suggestionCard:{backgroundColor:'#241D0D',borderRadius:radius.lg,borderWidth:1,borderColor:'#7C6517',padding:14},suggestionLabel:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:'#F1E7C0'},suggestionMain:{flexDirection:'row',gap:14,alignItems:'center',marginTop:10},plateMock:{width:105,height:82,borderRadius:18,backgroundColor:'#EDE7D6',alignItems:'center',justifyContent:'center'},plateEmoji:{fontSize:48},suggestionKcal:{fontSize:22,fontWeight:'900',color:colors.text},suggestionProtein:{fontSize:14,fontWeight:'800',color:colors.text,marginTop:2},goal:{fontSize:10,color:colors.yellow,marginTop:9},portionRow:{minHeight:48,paddingHorizontal:14,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},portionName:{flex:1,fontSize:12,color:colors.text},portionPill:{backgroundColor:colors.surfaceAlt,paddingHorizontal:9,paddingVertical:5,borderRadius:radius.pill},greenPill:{backgroundColor:colors.greenSoft},portionPillText:{fontSize:10,fontWeight:'800',color:colors.text},estimate:{backgroundColor:colors.surfaceAlt,borderRadius:radius.md,padding:13,marginTop:12,borderWidth:1,borderColor:colors.border},estimateStrong:{fontSize:11,fontWeight:'900',color:colors.text},estimateText:{fontSize:10,lineHeight:15,color:colors.muted,marginTop:4},primary:{backgroundColor:colors.yellow,minHeight:54,borderRadius:radius.md,alignItems:'center',justifyContent:'center',paddingHorizontal:16,marginTop:14},primaryText:{fontSize:13,fontWeight:'900',color:'#101010'},secondary:{backgroundColor:colors.surface,minHeight:50,borderRadius:radius.md,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,marginTop:9},secondaryText:{fontSize:12,fontWeight:'800',color:colors.text},disclaimer:{fontSize:10,lineHeight:15,color:colors.muted2,textAlign:'center',margin:14},warning:{backgroundColor:colors.yellowSoft,borderRadius:radius.lg,padding:16,borderWidth:1,borderColor:'#665813'},warningTitle:{fontSize:14,fontWeight:'900',color:colors.yellow},warningText:{fontSize:12,lineHeight:18,color:'#D9CCA1',marginTop:5},builderSummary:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:16,marginBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},builderCount:{fontSize:36,fontWeight:'900',color:colors.yellow},builderLabel:{fontSize:11,color:colors.muted},builderIcon:{fontSize:32},builderRow:{minHeight:64,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},stepper:{flexDirection:'row',alignItems:'center',gap:8},stepButton:{width:34,height:34,borderRadius:10,backgroundColor:colors.surfaceAlt,alignItems:'center',justifyContent:'center'},stepText:{fontSize:21,fontWeight:'900',color:colors.text},quantity:{minWidth:18,textAlign:'center',fontWeight:'900',color:colors.text},resultCard:{backgroundColor:colors.yellowSoft,borderRadius:radius.lg,padding:16,marginTop:14,borderWidth:1,borderColor:'#665813'},resultGood:{backgroundColor:colors.greenSoft,borderColor:'#1E6243'},resultBlocked:{backgroundColor:colors.dangerSoft,borderColor:'#6D2630'},resultTitle:{fontSize:16,fontWeight:'900',color:colors.text},resultText:{fontSize:11,lineHeight:17,color:colors.muted,marginTop:5},metrics:{flexDirection:'row',flexWrap:'wrap',marginTop:12},metric:{width:'50%',paddingVertical:8},metricValue:{fontSize:18,fontWeight:'900',color:colors.text},metricLabel:{fontSize:10,color:colors.muted,marginTop:2},pointsCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:15,flexDirection:'row',gap:15,alignItems:'center'},pointsRing:{width:70,height:70,borderRadius:35,borderWidth:5,borderColor:colors.yellow,alignItems:'center',justifyContent:'center'},pointsNumber:{fontSize:23,fontWeight:'900',color:colors.text},pointsTitle:{fontSize:12,fontWeight:'900',color:colors.text},pointsText:{fontSize:10,lineHeight:15,color:colors.muted,marginTop:4},segment:{height:36,marginTop:14,borderRadius:10,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',padding:3},segmentActive:{flex:1,height:30,borderRadius:8,backgroundColor:colors.red,alignItems:'center',justifyContent:'center'},segmentActiveText:{fontSize:10,fontWeight:'900',color:colors.white},segmentText:{flex:1,textAlign:'center',fontSize:10,color:colors.muted},chart:{height:150,marginTop:16,backgroundColor:colors.surface,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-around',paddingHorizontal:10,paddingBottom:12},barWrap:{alignItems:'center',justifyContent:'flex-end'},barValue:{fontSize:8,color:colors.muted,marginBottom:4},bar:{width:28,borderRadius:5,backgroundColor:colors.red},barYellow:{backgroundColor:colors.yellow},barLabel:{fontSize:8,color:colors.muted,marginTop:4},statGrid:{flexDirection:'row',gap:10,marginTop:12},stat:{flex:1,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:13},statIcon:{fontSize:19},statValue:{fontSize:18,fontWeight:'900',color:colors.text,marginTop:7},statLabel:{fontSize:9,color:colors.muted,marginTop:2},historyBlock:{padding:13,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},historyHeader:{flexDirection:'row',justifyContent:'space-between'},weekDate:{fontSize:12,fontWeight:'900',color:colors.text},historyTotal:{fontSize:11,fontWeight:'900',color:colors.yellow},historyItem:{fontSize:10,color:colors.muted,marginTop:5},emptyText:{fontSize:11,color:colors.muted,padding:14},feedbackQuestion:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:16},feedbackTitle:{fontSize:17,fontWeight:'900',color:colors.text},feedbackSub:{fontSize:11,lineHeight:16,color:colors.muted,marginTop:4},moodRow:{flexDirection:'row',gap:10,marginTop:12},mood:{flex:1,height:104,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},moodActive:{backgroundColor:colors.greenSoft,borderColor:colors.green},moodDanger:{backgroundColor:colors.dangerSoft,borderColor:colors.danger},moodIcon:{fontSize:38,color:colors.muted},moodIconActive:{color:colors.green},moodLabel:{fontSize:11,fontWeight:'900',color:colors.text,marginTop:5},ratingCard:{backgroundColor:colors.surface,borderRadius:radius.md,padding:14,marginTop:12,borderWidth:1,borderColor:colors.border},fieldTitle:{fontSize:12,fontWeight:'900',color:colors.text,marginTop:16,marginBottom:10},ratingRow:{flexDirection:'row',gap:8},rating:{width:42,height:42,borderRadius:12,backgroundColor:colors.surfaceAlt,alignItems:'center',justifyContent:'center'},ratingActive:{backgroundColor:colors.red},ratingText:{fontWeight:'900',color:colors.muted},ratingTextActive:{color:colors.white},tags:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12},tag:{paddingHorizontal:11,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},tagActive:{borderColor:colors.yellow,backgroundColor:colors.yellowSoft},tagText:{fontSize:10,color:colors.muted,textTransform:'capitalize'},tagTextActive:{color:colors.yellow},input:{backgroundColor:colors.surface,borderRadius:radius.md,minHeight:90,padding:13,textAlignVertical:'top',borderWidth:1,borderColor:colors.border,color:colors.text},done:{paddingTop:54,alignItems:'center'},doneIcon:{width:74,height:74,borderRadius:37,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'},doneCheck:{fontSize:35,fontWeight:'900',color:'#06160E'},doneTitle:{fontSize:23,fontWeight:'900',color:colors.text,marginTop:18,textAlign:'center'},doneText:{fontSize:12,lineHeight:18,color:colors.muted,textAlign:'center',marginTop:8,marginBottom:8},error:{backgroundColor:colors.dangerSoft,padding:13,borderRadius:radius.md,marginTop:14,borderWidth:1,borderColor:'#6D2630'},errorText:{color:'#FF9BA7',fontSize:11},nav:{height:82,backgroundColor:'#0B0E11',borderTopWidth:1,borderTopColor:colors.border,flexDirection:'row',paddingHorizontal:4,paddingBottom:8},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navIcon:{fontSize:19,color:colors.muted2},navLabel:{fontSize:8,color:colors.muted2,marginTop:4},navActive:{color:colors.red},navDot:{width:24,height:2,borderRadius:1,backgroundColor:colors.red,marginTop:4}
})
