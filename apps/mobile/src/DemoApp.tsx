import { useEffect, useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
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
import { DEMO_PERSON } from './demo'
import { Palette, shadow, useTheme, useThemedStyles } from './theme'
import { AppShell, AppTab, FoodIcon, PlateArt } from './AppShell'

type Screen = 'home' | 'menu' | 'recommendation' | 'builder' | 'feedback' | 'done' | 'progress'
type SelectedMap = Record<string, number>

type EmployeeUnit = { id: string; restaurantId: string; company: string; label: string }
type DemoAppProps = { initialTab?: AppTab; isDemo?: boolean; goal?: string | null; onProfile?: () => void; units: EmployeeUnit[] }

const today = () => { const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth()+1).padStart(2,'0'); const d = String(now.getDate()).padStart(2,'0'); return `${y}-${m}-${d}` }
const fmt = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${Math.round(value)}${suffix}`
const fmtPortion = (quantity: number, unit?: string | null) => { const q = Number(quantity); const cleanUnit = unit?.trim() || 'porção'; return q === 1 ? cleanUnit : `${Number.isInteger(q) ? q : q.toFixed(1)}× ${cleanUnit}` }
const shortDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${value}T12:00:00`)).replace('.', '')


export default function DemoApp({ goal, onProfile, units, isDemo, initialTab = 'home' }: DemoAppProps) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)

  const [screen, setCurrentScreen] = useState<Screen>('home')
  const [unitId, setUnitId] = useState(units[0].id)
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
  const [registeredMeal, setRegisteredMeal] = useState<{ itemCount:number; kcal:number|null } | null>(null)
  const [busy, setBusy] = useState(false)
  const [errorState, setErrorState] = useState<{screen: Screen; message: string} | null>(null)
  const error = errorState?.screen === screen ? errorState.message : ''
  const setError = (message: string) => setErrorState(message ? {screen, message} : null)
  const setScreen = (next: Screen) => { setErrorState(null); setCurrentScreen(next) }

  useEffect(() => {
    if (screen !== 'home') return
    let cancelled = false
    getMealProgress(DEMO_PERSON.id).then(data => { if (!cancelled) setProgress(data) }).catch(() => { if (!cancelled) setProgress(null) })
    return () => { cancelled = true }
  }, [screen])

  const unit = useMemo(() => units.find((item) => item.id === unitId) ?? units[0], [unitId, units])
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
      } else setSelected({})
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
      const saved = await registerSelectedMeal({
        personId: DEMO_PERSON.id,
        serviceDate: today(),
        selections: Object.entries(selected).filter(([, q]) => q > 0).map(([menuItemId, quantity]) => ({ menuItemId, quantity })),
      })
      setRegisteredMeal({ itemCount: saved.item_count, kcal: saved.estimated_totals.kcal })
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
    try {
      const saved = await registerMeal({ personId: DEMO_PERSON.id, serviceDate: today(), recommendation })
      setRegisteredMeal({ itemCount: saved.item_count, kcal: saved.estimated_totals.kcal })
      setScreen('feedback')
    }
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
      setTags([])
      setComment('')
      setScreen('done')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar sua avaliação.') }
    finally { setBusy(false) }
  }

  const goHome = () => { setError(''); setScreen('home') }

  useEffect(() => {
    if (initialTab === 'menu') void openMenu()
    else if (initialTab === 'plate') void openBuilder(false)
    else if (initialTab === 'progress') void openProgress()
  }, [])

  function navigate(tab: AppTab) {
    if (busy) return
    if (tab === 'home') goHome()
    else if (tab === 'menu') void openMenu()
    else if (tab === 'plate') void openBuilder(false)
    else if (tab === 'progress') void openProgress()
    else onProfile?.()
  }
  const activeTab: AppTab = screen === 'builder' || screen === 'recommendation' ? 'plate' : screen === 'menu' || screen === 'progress' ? screen : 'home'
  return (
    <AppShell active={activeTab} screenKey={screen} onNavigate={navigate} unitName={unit.company} name={DEMO_PERSON.name} isDemo={isDemo} busy={busy}>
        {screen === 'home' && <Home progress={progress}
          units={units} unitId={unitId}
          setUnitId={(id) => { setUnitId(id); setMenu(null) }}
          onMenu={openMenu}
          onRecommendation={openRecommendation}
          onBuilder={() => openBuilder(false)}
          onProgress={openProgress}
          onFeedback={() => setScreen('feedback')}
        />}

        {screen === 'menu' && <MenuScreen menu={menu} unitName={unit.company} onBuilder={() => openBuilder(false)} onRecommendation={openRecommendation}/>}

        {screen === 'recommendation' && recommendation && <RecommendationScreen recommendation={recommendation} goal={goal} onSave={saveRecommendedMeal} onCustomize={() => openBuilder(true)}/>}

        {screen === 'builder' && <BuilderScreen menu={menu} selected={selected} selectedCount={selectedCount} setQuantity={setQuantity} onEvaluate={evaluateCurrentPlate} plate={plate} onSave={saveManualPlate}/>}

        {screen === 'progress' && <ProgressScreen progress={progress} history={history} onStart={() => openBuilder(false)}/>}

        {screen === 'feedback' && <FeedbackScreen registeredMeal={registeredMeal} foodRating={foodRating} setFoodRating={setFoodRating} serviceRating={serviceRating} setServiceRating={setServiceRating} tags={tags} toggleTag={toggleTag} comment={comment} setComment={setComment} onSend={sendFeedback}/>}

        {screen === 'done' && <View style={styles.done}><View style={styles.doneIcon}><Ionicons name="checkmark" size={38} color={colors.green}/></View><Text style={styles.doneTitle}>Avaliação enviada!</Text><Text style={styles.doneText}>Obrigado por avaliar sua experiência no refeitório.</Text><View style={styles.rewardCard}><Ionicons name="sparkles-outline" size={20} color={colors.yellow}/><View style={styles.flex}><Text style={styles.rewardTitle}>Avaliação concluída</Text><Text style={styles.rewardText}>Os pontos são calculados pelas refeições registradas.</Text></View></View><Pressable accessibilityRole="button" style={styles.primary} onPress={openProgress}><Text style={styles.primaryText}>Ver meu progresso atualizado</Text></Pressable><Pressable accessibilityRole="button" style={styles.secondary} onPress={goHome}><Text style={styles.secondaryText}>Voltar ao início</Text></Pressable></View>}

        {!!error && <View accessibilityRole="alert" accessibilityLiveRegion="polite" style={styles.error}><Ionicons name="alert-circle-outline" size={17} color={colors.danger}/><Text style={styles.errorText}>{error}</Text></View>}
    </AppShell>
  )
}

function Home({ progress, units, unitId, setUnitId, onMenu, onRecommendation, onBuilder, onProgress, onFeedback }: { progress:MealProgress|null;units:EmployeeUnit[];unitId:string;setUnitId:(id:string)=>void;onMenu:()=>void;onRecommendation:()=>void;onBuilder:()=>void;onProgress:()=>void;onFeedback:()=>void }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)

  const { width } = useWindowDimensions()
  const wide = width >= 900
  const name = DEMO_PERSON.name.split(' ')[0]
  const registeredToday = Boolean(progress?.series.some(day => day.date === today()))
  return <>
    <View style={styles.pageHeading}><View style={styles.flex}><Text style={styles.kicker}>BEM-VINDO À SUA PAUSA</Text><Text style={styles.pageTitle}>Olá, {name}.</Text><Text style={styles.pageSub}>Vamos fazer uma boa escolha hoje?</Text></View><View style={styles.todayBadge}><Ionicons name="sunny-outline" size={16} color={colors.yellow}/><Text style={styles.todayBadgeText}>Almoço</Text></View></View>
    <View style={[styles.homeHero, wide && styles.homeHeroWide]}>
      <View style={styles.heroCopy}><Text style={styles.homeTag}>ALIMENTA O QUE TE FAZ BEM</Text><Text style={[styles.homeBrand, wide && { fontSize: 38, lineHeight: 44 }]}>Seu momento.{'\n'}Seu prato.</Text><Text style={styles.homeSubtitle}>Mais sabor e cuidado na sua rotina.</Text><Pressable accessibilityRole="button" style={styles.heroAction} onPress={onBuilder}><Text style={styles.heroActionText}>Montar meu prato</Text><Ionicons name="arrow-forward" size={18} color="#BD2343"/></Pressable></View>
      {width > 360 && <View style={[styles.heroArt, wide && styles.heroArtWide]}><PlateArt small={!wide}/></View>}
    </View>

    <View style={styles.quickHeader}><Text style={styles.quickTitle}>O que vamos fazer?</Text><Text style={styles.quickHint}>Seu almoço, do seu jeito</Text></View>
    <View style={styles.quickGrid}>
      <QuickAction title="Ver o cardápio" detail="Conheça as opções de hoje" icon="calendar-outline" onPress={onMenu} />
      <QuickAction title="Quanto pegar hoje" detail="Uma sugestão de porções" icon="scale-outline" onPress={onRecommendation} green />
      <QuickAction title="Avaliar o refeitório" detail="Conte como foi sua experiência" icon="chatbubble-ellipses-outline" onPress={onFeedback} />
    </View>

    <View style={styles.quickHeader}><Text style={styles.quickTitle}>Cada escolha conta</Text><Pressable accessibilityRole="button" onPress={onProgress}><Text style={styles.textLink}>Ver progresso →</Text></Pressable></View>
    <Pressable accessibilityRole="button" accessibilityLabel="Ver minhas conquistas" style={styles.achievementCard} onPress={onProgress}>
      <View style={styles.scoreRing}><Text style={styles.score}>{progress ? progress.meal_days * 5 : '—'}</Text><Text style={styles.scoreLabel}>pontos</Text></View>
      <View style={styles.flex}><Text style={styles.achievementTitle}>{registeredToday ? 'Refeição de hoje registrada!' : 'Um passo de cada vez'}</Text><Text style={styles.achievementLine}>{progress ? `${progress.meal_days} ${progress.meal_days === 1 ? 'dia com refeição registrada' : 'dias com refeições registradas'} nos últimos 7 dias.` : 'Seu progresso está sendo carregado.'}</Text><View style={styles.achievementRow}><Ionicons name={registeredToday ? 'checkmark-circle' : 'ellipse-outline'} size={15} color={colors.green}/><Text style={styles.achievementLine}>{registeredToday ? 'Continue construindo sua rotina.' : 'Registre seu almoço para ganhar 5 pontos.'}</Text></View></View>
    </Pressable>
    <View style={styles.unitFooter}><Ionicons name="location-outline" size={17} color={colors.muted}/><Text style={styles.unitFooterText}>Sua unidade</Text>{units.map(item => <Pressable accessibilityRole="button" accessibilityState={{ selected: unitId === item.id }} key={item.id} onPress={() => setUnitId(item.id)}><Text style={styles.unitName}>{item.company}</Text></Pressable>)}</View>
  </>
}

function QuickAction({title, detail, icon, onPress, green = false}:{title:string;detail:string;icon:keyof typeof Ionicons.glyphMap;onPress:()=>void;green?:boolean}) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)

  const { width } = useWindowDimensions()
  const wide = width >= 900
  return <Pressable accessibilityRole="button" onPress={onPress} style={({pressed})=>[styles.quickCard, wide && styles.quickCardWide, pressed && {opacity:0.7}]}>
    <View style={[styles.quickIcon, green && {backgroundColor:colors.greenSoft}]}><Ionicons name={icon} size={24} color={green?colors.green:colors.red}/></View>
    <View style={styles.flex}><Text style={styles.quickText}>{title}</Text><Text style={styles.quickDetail}>{detail}</Text></View>
    <Ionicons name="arrow-forward" size={18} color={colors.muted}/>
  </Pressable>
}

function MenuScreen({ menu, unitName, onBuilder, onRecommendation }: { menu:PublishedMenu|null; unitName:string; onBuilder:()=>void; onRecommendation:()=>void }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)

  const { width } = useWindowDimensions()
  const [filter, setFilter] = useState<'todos'|'proteinas'|'carboidratos'|'saladas'>('todos')
  const filteredItems = (menu?.items ?? []).filter((item) => {
    if (filter === 'todos') return true
    if (filter === 'proteinas') return item.category === 'prato_principal'
    if (filter === 'carboidratos') return ['arroz','feijao','guarnicao'].includes(item.category)
    return item.category === 'salada'
  })
  return <>
    <Text style={styles.kicker}>CARDÁPIO DO DIA</Text><Text style={styles.pageTitle}>Cardápio de hoje</Text><Text style={styles.pageSub}>{unitName} · almoço</Text>
    <View style={styles.filterRow}>
      <Filter active={filter==='todos'} label="Todos" onPress={()=>setFilter('todos')}/>
      <Filter active={filter==='proteinas'} label="Proteínas" onPress={()=>setFilter('proteinas')}/>
      <Filter active={filter==='carboidratos'} label="Acompanhamentos" onPress={()=>setFilter('carboidratos')}/>
      <Filter active={filter==='saladas'} label="Saladas" onPress={()=>setFilter('saladas')}/>
    </View>
    <View style={styles.menuCaption}><Text style={styles.sectionLabelInline}>{filteredItems.length} opções disponíveis</Text><Text style={styles.menuCaptionText}>Valores por porção</Text></View>
    {filteredItems.length > 0 ? <View style={styles.menuGrid}>{filteredItems.map(item => <View key={item.id} style={[styles.foodCard, width >= 900 && {width:'48.8%'}]}>
      <View style={styles.menuRow}><FoodIcon category={item.category}/><View style={styles.flex}><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'}</Text></View></View>
      <View style={styles.foodFooter}><Text style={styles.foodCategory}>{categoryLabel(item.category)}</Text><Text style={styles.foodEnergy}>{fmt(item.kcal, ' kcal')}</Text></View>
    </View>)}</View> : <View style={styles.emptyState}><Ionicons name="restaurant-outline" size={28} color={colors.muted2}/><Text style={styles.emptyStateTitle}>Nenhum item nesta categoria</Text><Text style={styles.emptyStateText}>Veja outra categoria ou escolha “Todos”.</Text></View>}
    <Pressable accessibilityRole="button" style={styles.primary} onPress={onBuilder}><View style={styles.buttonInner}><Ionicons name="restaurant-outline" size={18} color={colors.white}/><Text style={styles.primaryText}>Montar meu prato</Text></View></Pressable>
    <Pressable accessibilityRole="button" style={styles.secondary} onPress={onRecommendation}><Text style={styles.secondaryText}>Ver recomendação automática</Text></Pressable>
  </>
}
function RecommendationScreen({ recommendation, goal, onSave, onCustomize }: { recommendation:Recommendation; goal?:string|null; onSave:()=>void; onCustomize:()=>void }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)

  const goalLabel = goal === 'seguir_prescricao' ? 'seguir minha prescrição' : goal === 'melhorar_habitos' ? 'melhorar meus hábitos' : 'manter o equilíbrio'
  return <>
    <Text style={styles.pageTitle}>Quanto pegar hoje</Text><Text style={styles.pageSub}>{recommendation.presentation_mode ? 'Simulação de como a Apetit combina sua prescrição com o cardápio disponível.' : 'Sugestão baseada na sua prescrição e no cardápio disponível.'}</Text>
    {recommendation.status === 'insufficient_data' ? <View style={styles.warning}><Text style={styles.warningTitle}>Ainda não dá para calcular com segurança</Text><Text style={styles.warningText}>{recommendation.message}</Text></View> : <>
      <View style={styles.suggestionCard}>
        <Text style={styles.suggestionLabel}>{recommendation.presentation_mode ? 'DEMONSTRAÇÃO · PRATO SUGERIDO' : 'SEU PRATO SUGERIDO HOJE'}</Text>
        <View style={styles.suggestionMain}><PlateArt small/><View style={styles.flex}><Text style={styles.suggestionKcal}>{fmt(recommendation.estimated_totals?.kcal, ' kcal')}</Text><Text style={styles.suggestionProtein}>{fmt(recommendation.estimated_totals?.protein_g, ' g de proteína')}</Text><View style={styles.goalRow}><Ionicons name="radio-button-on" size={14} color={colors.yellow}/><Text style={styles.goal}>Objetivo · {goalLabel}</Text></View></View></View>
      </View>
      <Text style={styles.sectionLabel}>SUAS PORÇÕES</Text>
      <View style={styles.listCard}>{recommendation.items.map((item, index) => <View key={item.menu_item_id} style={styles.portionRow}><Text style={styles.portionName}>{item.name}</Text><View style={[styles.portionPill,index===recommendation.items.length-1&&styles.greenPill]}><Text style={styles.portionPillText}>{item.portion ?? '1 porção'}</Text></View></View>)}</View>
      <View style={styles.estimate}><Text style={styles.estimateStrong}>Estimativa: {fmt(recommendation.estimated_totals?.kcal,' kcal')} · {fmt(recommendation.estimated_totals?.protein_g,' g de proteína')}</Text><Text style={styles.estimateText}>Essa sugestão considera seu objetivo e as opções disponíveis hoje.</Text></View>
      <Pressable accessibilityRole="button" style={styles.primary} onPress={onSave}><View style={styles.buttonInner}><Ionicons name="checkmark-circle-outline" size={18} color={colors.white}/><Text style={styles.primaryText}>Vou pegar isso — registrar</Text></View></Pressable>
      <Pressable accessibilityRole="button" style={styles.secondary} onPress={onCustomize}><View style={styles.buttonInner}><Ionicons name="restaurant-outline" size={17} color={colors.text}/><Text style={styles.secondaryText}>Montar do meu jeito</Text></View></Pressable>
      <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>
    </>}
  </>
}

function BuilderScreen({ menu, selected, selectedCount, setQuantity, onEvaluate, plate, onSave }: { menu:PublishedMenu|null; selected:SelectedMap; selectedCount:number; setQuantity:(id:string,q:number)=>void; onEvaluate:()=>void; plate:PlateEvaluation|null; onSave:()=>void }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)

  const items = menu?.items ?? []

  return <>
    <Text style={styles.pageTitle}>Montar meu prato</Text>
    <Text style={styles.pageSub}>Ajuste suas porções e confira como o prato se aproxima da sua meta.</Text>

    <View style={styles.builderSummary}>
      <View>
        <Text style={styles.builderCount}>{selectedCount}</Text>
        <Text style={styles.builderLabel}>{selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}</Text>
      </View>
      <View style={styles.builderHint}><Ionicons name="restaurant-outline" size={24} color={colors.green}/><Text style={styles.builderHintText}>Use + e − para ajustar as porções.</Text></View>
    </View>

    {items.length > 0 ? (
      <View style={styles.listCard}>
        {items.map((item) => {
          const quantity = selected[item.id] ?? 0
          return (
            <View key={item.id} style={[styles.builderRow, quantity > 0 && styles.builderRowSelected]}>
              <View style={styles.flex}>
                <Text style={styles.menuName}>{item.name}</Text>
                <Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'} · {fmt(item.kcal,' kcal')}</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable accessibilityRole="button" accessibilityLabel={`Diminuir porção de ${item.name}`} disabled={quantity === 0} style={[styles.stepButton, quantity === 0 && styles.disabled]} onPress={()=>setQuantity(item.id,quantity-1)}>
                  <Ionicons name="remove" size={18} color={colors.text}/>
                </Pressable>
                <Text style={styles.quantity}>{quantity}</Text>
                <Pressable accessibilityRole="button" accessibilityLabel={`Adicionar porção de ${item.name}`} disabled={quantity >= 3} style={[styles.stepButton, styles.stepButtonAdd, quantity >= 3 && styles.disabled]} onPress={()=>setQuantity(item.id,quantity+1)}>
                  <Ionicons name="add" size={18} color={colors.red}/>
                </Pressable>
              </View>
            </View>
          )
        })}
      </View>
    ) : (
      <View style={styles.emptyState}>
        <Ionicons name="restaurant-outline" size={28} color={colors.muted2}/>
        <Text style={styles.emptyStateTitle}>Cardápio ainda não disponível</Text>
        <Text style={styles.emptyStateText}>Assim que o cardápio do dia for publicado, os itens aparecem aqui para montar seu prato.</Text>
      </View>
    )}

    <Pressable accessibilityRole="button" disabled={!selectedCount} style={[styles.primary, !selectedCount && styles.disabled]} onPress={onEvaluate}>
      <Text style={styles.primaryText}>Avaliar meu prato</Text>
    </Pressable>

    {plate && (
      <View style={[
        styles.resultCard,
        plate.status==='blocked' && styles.resultBlocked,
        plate.status==='within_target' && styles.resultGood,
      ]}>
        <View style={styles.resultTitleRow}>
          <Ionicons
            name={plate.status==='within_target' ? 'checkmark-circle' : 'alert-circle'}
            size={20}
            color={plate.status==='within_target' ? colors.green : colors.yellow}
          />
          <Text style={styles.resultTitle}>
            {plate.status==='within_target'
              ? 'Próximo da sua meta'
              : plate.status==='blocked'
                ? 'Atenção à segurança'
                : plate.status==='insufficient_data'
                  ? 'Dados insuficientes'
                  : 'Seu prato pode melhorar'}
          </Text>
        </View>
        <Text style={styles.resultText}>{plate.message}</Text>
        <MacroGrid totals={plate.estimated_totals}/>
        {plate.status!=='blocked' && plate.status!=='insufficient_data' && (
          <Pressable accessibilityRole="button" style={styles.primary} onPress={onSave}>
            <Text style={styles.primaryText}>Registrar este prato</Text>
          </Pressable>
        )}
      </View>
    )}
  </>
}

function ProgressScreen({ progress, history, onStart }: { progress:MealProgress|null; history:MealHistory|null; onStart:()=>void }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)

  const series=(progress?.series??[]).slice(-7)
  const maxKcal=Math.max(...series.map(d=>d.totals.kcal??0),1)
  const points=(progress?.meal_days ?? 0)*5
  return <>
    <Text style={styles.kicker}>SUA ROTINA, PASSO A PASSO</Text><Text style={styles.pageTitle}>Meu progresso</Text><Text style={styles.pageSub}>Pequenas escolhas que fazem parte do seu dia.</Text>
    <View style={styles.pointsCard}><View style={styles.pointsRing}><Ionicons name="trophy-outline" size={22} color={colors.green}/><Text style={styles.pointsNumber}>{points}</Text></View><View style={styles.flex}><Text style={styles.pointsTitle}>pontos nos últimos 7 dias</Text><Text style={styles.pointsText}>{points ? 'Cada dia com uma refeição registrada vale 5 pontos.' : 'Sua jornada começa com o primeiro registro.'}</Text></View></View>
    <View style={styles.quickHeader}><Text style={styles.quickTitle}>Sua semana</Text><View style={styles.periodBadge}><Text style={styles.periodBadgeText}>Últimos 7 dias</Text></View></View>
    {series.length ? <View style={styles.chart}>{series.map(day=>{const height=12+Math.round(((day.totals.kcal??0)/maxKcal)*98);return <View key={day.date} style={styles.barWrap}><Text style={styles.barValue}>{fmt(day.totals.kcal)}</Text><View style={styles.barTrack}><View style={[styles.bar,{height}]}/></View><Text style={styles.barLabel}>{shortDate(day.date)}</Text></View>})}</View> : <View style={styles.emptyState}><View style={styles.emptyIcon}><Ionicons name="restaurant-outline" size={30} color={colors.green}/></View><Text style={styles.emptyStateTitle}>Seu primeiro prato é o começo.</Text><Text style={styles.emptyStateText}>Registre uma refeição para acompanhar sua rotina aqui.</Text><Pressable accessibilityRole="button" style={styles.primary} onPress={onStart}><Text style={styles.primaryText}>Montar meu primeiro prato</Text></Pressable></View>}
    {series.length > 0 && <Text style={styles.chartCaption}>Energia estimada das refeições · kcal por dia</Text>}
    <View style={styles.statGrid}><Stat icon="fitness-outline" value={`${progress?.adherent_days ?? 0}/${progress?.meal_days ?? 0}`} label="Dias dentro da faixa"/><Stat icon="restaurant-outline" value={`${progress?.meal_days ?? 0}`} label="Dias com refeição"/></View>
    <Text style={styles.sectionLabel}>REFEIÇÕES RECENTES</Text>
    <View style={styles.listCard}>{history?.meals.length?history.meals.slice(0,4).map(meal=><View key={meal.meal_id} style={styles.historyBlock}><View style={styles.historyHeader}><Text style={styles.weekDate}>{new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(`${meal.meal_date}T12:00:00`))}</Text><Text style={styles.historyTotal}>{fmt(meal.totals.kcal,' kcal')}</Text></View>{meal.items.map((item,index)=><View key={`${meal.meal_id}-${index}`} style={styles.historyItemRow}><Ionicons name="checkmark-circle" size={15} color={colors.green}/><Text style={styles.historyItem}>{item.item_name} · {fmtPortion(item.quantity,item.unit)}</Text></View>)}</View>):<Text style={styles.emptyText}>Suas refeições aparecerão aqui após o primeiro registro.</Text>}</View>
  </>
}

function FeedbackScreen({ registeredMeal, foodRating, setFoodRating, serviceRating, setServiceRating, tags, toggleTag, comment, setComment, onSend }: { registeredMeal:{itemCount:number;kcal:number|null}|null; foodRating:number; setFoodRating:(v:number)=>void; serviceRating:number; setServiceRating:(v:number)=>void; tags:string[]; toggleTag:(v:string)=>void; comment:string; setComment:(v:string)=>void; onSend:()=>void }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)

  return <>
    {registeredMeal && <View style={styles.mealSavedBanner}>
      <View style={styles.mealSavedIcon}><Ionicons name="checkmark" size={18} color={colors.green}/></View>
      <View style={styles.flex}>
        <Text style={styles.mealSavedTitle}>Seu prato foi registrado</Text>
        <Text style={styles.mealSavedText}>{registeredMeal.itemCount} itens · {fmt(registeredMeal.kcal,' kcal')} estimadas</Text>
      </View>
    </View>}
    <Text style={styles.pageTitle}>Como foi o almoço de hoje?</Text>
    <Text style={styles.pageSub}>Leva menos de 30 segundos e ajuda a Apetit a melhorar o refeitório.</Text>
    <View style={styles.feedbackQuestion}>
      <Text style={styles.feedbackTitle}>A comida estava boa?</Text>
      <Text style={styles.feedbackSub}>Sua resposta entra nos relatórios de forma agregada.</Text>
    </View>
    <View style={styles.moodRow}>
      <Mood active={foodRating>=4} icon="happy-outline" label="Boa" onPress={()=>setFoodRating(5)}/>
      <Mood active={foodRating===3} icon="remove-circle-outline" label="Regular" onPress={()=>setFoodRating(3)}/>
      <Mood danger active={foodRating<=2} icon="sad-outline" label="Ruim" onPress={()=>setFoodRating(1)}/>
    </View>
    <Rating title="Atendimento" value={serviceRating} onChange={setServiceRating}/>
    <Text style={styles.fieldTitle}>O que mais influenciou sua avaliação?</Text>
    <View style={styles.tags}>{['sabor','temperatura','variedade','atendimento','outro'].map((tag)=><Pressable accessibilityRole="button" key={tag} style={[styles.tag,tags.includes(tag)&&styles.tagActive]} onPress={()=>toggleTag(tag)}><Text style={[styles.tagText,tags.includes(tag)&&styles.tagTextActive]}>{tag}</Text></Pressable>)}</View>
    <TextInput style={styles.input} placeholder="Quer acrescentar algo? (opcional)" placeholderTextColor={colors.muted2} multiline value={comment} onChangeText={setComment}/>
    <Pressable accessibilityRole="button" style={styles.primary} onPress={onSend}><View style={styles.buttonInner}><Ionicons name="send-outline" size={17} color={colors.white}/><Text style={styles.primaryText}>Enviar avaliação</Text></View></Pressable>
    <Text style={styles.feedbackPrivacy}>Seus dados pessoais, restrições e prescrição não aparecem nos relatórios corporativos.</Text>
  </>
}

function Filter({label,active=false,onPress}:{label:string;active?:boolean;onPress:()=>void}) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)
 return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.filter,active&&styles.filterActive]}><Text style={[styles.filterText,active&&styles.filterTextActive]}>{label}</Text></Pressable> }
function categoryLabel(category: string) { return ({ prato_principal: 'Prato principal', arroz: 'Acompanhamento', feijao: 'Acompanhamento', guarnicao: 'Guarnição', salada: 'Salada', sobremesa: 'Sobremesa' } as Record<string,string>)[category] ?? 'No cardápio' }
function Mood({icon,label,active,danger=false,onPress}:{icon:keyof typeof Ionicons.glyphMap;label:string;active:boolean;danger?:boolean;onPress:()=>void}) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)
 return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} onPress={onPress} style={[styles.mood,active&&styles.moodActive,danger&&active&&styles.moodDanger]}><Ionicons name={icon} size={38} color={danger&&active?colors.danger:active?colors.green:colors.muted}/><Text style={styles.moodLabel}>{label}</Text></Pressable> }
function MacroGrid({ totals }: { totals?: { kcal:number|null;protein_g:number|null;carbs_g:number|null;fat_g:number|null } }) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)
 return <View style={styles.metrics}><Metric label="Energia" value={fmt(totals?.kcal,' kcal')}/><Metric label="Proteína" value={fmt(totals?.protein_g,' g')}/><Metric label="Carboidratos" value={fmt(totals?.carbs_g,' g')}/><Metric label="Gorduras" value={fmt(totals?.fat_g,' g')}/></View> }
function Metric({label,value}:{label:string;value:string}) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)
 return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
function Stat({icon,value,label}:{icon:keyof typeof Ionicons.glyphMap;value:string;label:string}) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)
 return <View style={styles.stat}><Ionicons name={icon} size={20} color={colors.red}/><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View> }
function Rating({title,value,onChange}:{title:string;value:number;onChange:(v:number)=>void}) {
  const { colors } = useTheme()
  const styles = useThemedStyles(makeStyles)
 return <View style={styles.ratingCard}><Text style={styles.fieldTitle}>{title}</Text><View style={styles.ratingRow}>{[1,2,3,4,5].map(n=><Pressable accessibilityRole="button" accessibilityLabel={`Nota ${n} para ${title}`} accessibilityState={{ selected: value === n }} key={n} style={[styles.rating,value===n&&styles.ratingActive]} onPress={()=>onChange(n)}><Text style={[styles.ratingText,value===n&&styles.ratingTextActive]}>{n}</Text></Pressable>)}</View></View> }

const makeStyles = (colors: Palette) => StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  pageHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 },
  kicker: { fontSize: 11, lineHeight: 16, fontWeight: '700', letterSpacing: 1.5, color: colors.muted },
  pageTitle: { fontSize: 30, lineHeight: 37, fontWeight: '700', letterSpacing: -0.9, color: colors.text, marginTop: 5 },
  pageSub: { fontSize: 15, lineHeight: 23, color: colors.muted, marginTop: 7, marginBottom: 24 },
  todayBadge: { flexDirection: 'row', gap: 5, alignItems: 'center', padding: 9, borderRadius: 12, backgroundColor: colors.yellowSoft },
  todayBadgeText: { fontSize: 12, color: colors.yellow, fontWeight: '600' },
  homeHero: { backgroundColor: colors.hero, borderRadius: 24, padding: 24, minHeight: 245, overflow: 'hidden', flexDirection: 'row' },
  homeHeroWide: { padding: 32, minHeight: 265 }, heroCopy: { flex: 1, zIndex: 1 },
  homeTag: { fontSize: 10, fontWeight: '600', letterSpacing: 1.5, color: '#FFE3E9' },
  homeBrand: { fontSize: 32, lineHeight: 37, fontWeight: '700', letterSpacing: -0.8, color: colors.white, marginTop: 15 },
  homeSubtitle: { fontSize: 14, lineHeight: 21, color: '#FFE3E9', marginTop: 9, maxWidth: 220 },
  heroAction: { alignSelf: 'flex-start', minHeight: 48, borderRadius: 12, backgroundColor: '#FFFFFF', marginTop: 22, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroActionText: { fontSize: 14, fontWeight: '700', color: '#A71E3C' },
  heroArt: { position: 'absolute', right: -26, top: 40, opacity: 0.36 }, heroArtWide: { right: 60, top: 48, opacity: 1, transform: [{scale: 1.2}] },
  quickHeader: { marginTop: 28, marginBottom: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  quickTitle: { fontSize: 19, lineHeight: 26, fontWeight: '600', color: colors.text, letterSpacing: -0.35 }, quickHint: { fontSize: 12, color: colors.muted },
  textLink: { fontSize: 13, lineHeight: 22, color: colors.red, fontWeight: '600' },
  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  quickCard: { width: '100%', minHeight: 88, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  quickCardWide: { flex: 1, minWidth: 180, width: 'auto', minHeight: 186, flexDirection: 'column', alignItems: 'flex-start' },
  quickIcon: { width: 45, height: 45, borderRadius: 13, backgroundColor: colors.redSoft, alignItems: 'center', justifyContent: 'center' },
  quickText: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.text }, quickDetail: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 4 },
  achievementCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 20, flexDirection: 'row', alignItems: 'center', gap: 18, ...shadow },
  achievementTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', color: colors.text, marginBottom: 6 },
  achievementRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }, achievementLine: { fontSize: 13, lineHeight: 20, color: colors.muted, flex: 1 },
  scoreRing: { width: 72, height: 72, borderRadius: 36, borderWidth: 4, borderColor: colors.green, alignItems: 'center', justifyContent: 'center' },
  score: { fontSize: 24, fontWeight: '700', color: colors.text }, scoreLabel: { fontSize: 11, color: colors.muted },
  unitFooter: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, alignItems: 'center', marginTop: 24 }, unitFooterText: { fontSize: 12, color: colors.muted }, unitName: { fontSize: 13, color: colors.text, fontWeight: '600' },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1.2, color: colors.muted, marginTop: 25, marginBottom: 12 },
  sectionLabelInline: { fontSize: 13, color: colors.text, fontWeight: '600' },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 22, flexWrap: 'wrap' },
  filter: { minHeight: 42, justifyContent: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  filterActive: { backgroundColor: colors.brand, borderColor: colors.brand }, filterText: { fontSize: 13, fontWeight: '500', color: colors.muted }, filterTextActive: { color: colors.white },
  menuCaption: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 13, gap: 8 }, menuCaptionText: { fontSize: 12, color: colors.muted },
  menuGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 14 },
  foodCard: { width: '100%', borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, padding: 18 },
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 55 }, menuName: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.text }, menuMeta: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 4 },
  foodFooter: { marginTop: 17, paddingTop: 13, borderTopWidth: 1, borderColor: colors.borderSoft, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  foodCategory: { fontSize: 12, color: colors.muted }, foodEnergy: { fontSize: 14, fontWeight: '600', color: colors.green },
  emptyState: { backgroundColor: colors.surface, borderRadius: 20, borderWidth: 1, borderColor: colors.border, padding: 28, alignItems: 'center', justifyContent: 'center' },
  emptyIcon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' },
  emptyStateTitle: { fontSize: 18, lineHeight: 26, fontWeight: '600', color: colors.text, marginTop: 14, textAlign: 'center' },
  emptyStateText: { fontSize: 14, lineHeight: 22, color: colors.muted, textAlign: 'center', marginTop: 7, maxWidth: 350 },
  listCard: { backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  suggestionCard: { backgroundColor: colors.yellowSoft, borderRadius: 22, padding: 22 }, suggestionLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 1.2, color: colors.yellow },
  suggestionMain: { flexDirection: 'row', gap: 14, alignItems: 'center', marginTop: 10 }, suggestionKcal: { fontSize: 27, fontWeight: '700', color: colors.text }, suggestionProtein: { fontSize: 15, color: colors.text, marginTop: 5 },
  goalRow: { flexDirection: 'row', gap: 5, alignItems: 'center', marginTop: 12 }, goal: { fontSize: 12, lineHeight: 19, color: colors.yellow, flex: 1 },
  portionRow: { minHeight: 62, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  portionName: { flex: 1, fontSize: 15, lineHeight: 22, color: colors.text }, portionPill: { backgroundColor: colors.surfaceAlt, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, maxWidth: '48%' }, greenPill: { backgroundColor: colors.greenSoft }, portionPillText: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: colors.text },
  estimate: { backgroundColor: colors.surfaceAlt, borderRadius: 16, padding: 18, marginTop: 14 }, estimateStrong: { fontSize: 14, lineHeight: 22, fontWeight: '600', color: colors.text }, estimateText: { fontSize: 13, lineHeight: 21, color: colors.muted, marginTop: 6 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  primary: { backgroundColor: colors.brand, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18, paddingVertical: 14, marginTop: 20 },
  primaryText: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: colors.white, textAlign: 'center' },
  secondary: { backgroundColor: colors.surface, minHeight: 50, padding: 12, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, marginTop: 10 }, secondaryText: { fontSize: 14, fontWeight: '600', color: colors.text, textAlign: 'center' },
  disclaimer: { fontSize: 12, lineHeight: 20, color: colors.muted2, textAlign: 'center', margin: 16 }, disabled: { opacity: 0.4 },
  warning: { backgroundColor: colors.yellowSoft, borderRadius: 18, padding: 20 }, warningTitle: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.yellow }, warningText: { fontSize: 14, lineHeight: 22, color: colors.muted, marginTop: 7 },
  builderSummary: { backgroundColor: colors.greenSoft, borderRadius: 20, padding: 20, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
  builderCount: { fontSize: 34, fontWeight: '700', color: colors.green }, builderLabel: { fontSize: 13, color: colors.muted, marginTop: 2 }, builderHint: { maxWidth: 150, alignItems: 'flex-end', gap: 8 }, builderHintText: { fontSize: 12, lineHeight: 18, color: colors.muted, textAlign: 'right' },
  builderRow: { minHeight: 94, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, builderRowSelected: { backgroundColor: colors.greenSoft },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 5 }, stepButton: { width: 44, height: 44, borderRadius: 13, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, stepButtonAdd: { backgroundColor: colors.redSoft }, quantity: { minWidth: 24, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  resultCard: { backgroundColor: colors.yellowSoft, borderRadius: 20, padding: 22, marginTop: 20 }, resultGood: { backgroundColor: colors.greenSoft }, resultBlocked: { backgroundColor: colors.dangerSoft },
  resultTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 9 }, resultTitle: { fontSize: 18, lineHeight: 25, fontWeight: '600', color: colors.text, flex: 1 }, resultText: { fontSize: 14, lineHeight: 22, color: colors.muted, marginTop: 8 },
  metrics: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 16 }, metric: { width: '50%', paddingVertical: 10 }, metricValue: { fontSize: 20, fontWeight: '600', color: colors.text }, metricLabel: { fontSize: 12, color: colors.muted, marginTop: 4 },
  pointsCard: { backgroundColor: colors.greenSoft, borderRadius: 22, padding: 22, flexDirection: 'row', gap: 20, alignItems: 'center' }, pointsRing: { width: 76, height: 76, borderRadius: 24, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', gap: 3 }, pointsNumber: { fontSize: 26, fontWeight: '700', color: colors.text }, pointsTitle: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.text }, pointsText: { fontSize: 13, lineHeight: 21, color: colors.muted, marginTop: 5 },
  periodBadge: { backgroundColor: colors.surfaceAlt, borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 }, periodBadgeText: { fontSize: 12, color: colors.muted },
  chart: { height: 190, backgroundColor: colors.surface, borderRadius: 18, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-around', padding: 18 },
  barWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 148 }, barValue: { fontSize: 11, color: colors.muted, marginBottom: 6 }, barTrack: { height: 110, width: 30, justifyContent: 'flex-end', alignItems: 'center' }, bar: { width: 24, borderRadius: 6, backgroundColor: colors.brand }, barLabel: { fontSize: 12, color: colors.muted, marginTop: 8, textTransform: 'capitalize' }, chartCaption: { fontSize: 12, lineHeight: 20, color: colors.muted, marginTop: 8 },
  statGrid: { flexDirection: 'row', gap: 12, marginTop: 16 }, stat: { flex: 1, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 18 }, statValue: { fontSize: 24, fontWeight: '600', color: colors.text, marginTop: 12 }, statLabel: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 5 },
  historyBlock: { padding: 20, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }, historyHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }, weekDate: { fontSize: 15, fontWeight: '600', color: colors.text }, historyTotal: { fontSize: 14, fontWeight: '600', color: colors.green }, historyItemRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 7 }, historyItem: { fontSize: 13, lineHeight: 20, color: colors.muted, flex: 1 }, emptyText: { fontSize: 14, lineHeight: 22, color: colors.muted, padding: 20 },
  feedbackQuestion: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 22 }, feedbackTitle: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: colors.text }, feedbackSub: { fontSize: 14, lineHeight: 22, color: colors.muted, marginTop: 6 }, moodRow: { flexDirection: 'row', gap: 12, marginTop: 16 }, mood: { flex: 1, height: 110, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' }, moodActive: { backgroundColor: colors.greenSoft, borderColor: colors.green }, moodDanger: { backgroundColor: colors.dangerSoft, borderColor: colors.danger }, moodLabel: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 8 },
  ratingCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 20, marginTop: 16, borderWidth: 1, borderColor: colors.border }, fieldTitle: { fontSize: 15, fontWeight: '600', color: colors.text, marginTop: 12, marginBottom: 14 }, ratingRow: { flexDirection: 'row', gap: 9 }, rating: { flex: 1, height: 44, borderRadius: 12, backgroundColor: colors.surfaceAlt, alignItems: 'center', justifyContent: 'center' }, ratingActive: { backgroundColor: colors.brand }, ratingText: { fontSize: 15, fontWeight: '600', color: colors.muted }, ratingTextActive: { color: colors.white },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 9, marginBottom: 16 }, tag: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, tagActive: { borderColor: colors.yellow, backgroundColor: colors.yellowSoft }, tagText: { fontSize: 13, color: colors.muted, textTransform: 'capitalize' }, tagTextActive: { color: colors.yellow },
  input: { backgroundColor: colors.surface, borderRadius: 16, minHeight: 110, padding: 16, fontSize: 16, lineHeight: 23, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.border, color: colors.text },
  done: { paddingTop: 34, alignItems: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' }, doneIcon: { width: 82, height: 82, borderRadius: 41, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, doneTitle: { fontSize: 28, fontWeight: '700', color: colors.text, marginTop: 22, textAlign: 'center' }, doneText: { fontSize: 15, lineHeight: 24, color: colors.muted, textAlign: 'center', marginTop: 10, marginBottom: 10 }, rewardCard: { width: '100%', marginTop: 14, backgroundColor: colors.yellowSoft, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12 }, rewardTitle: { fontSize: 16, fontWeight: '600', color: colors.yellow }, rewardText: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 5 },
  mealSavedBanner: { backgroundColor: colors.greenSoft, borderRadius: 18, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 }, mealSavedIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, mealSavedTitle: { fontSize: 15, fontWeight: '600', color: colors.green }, mealSavedText: { fontSize: 13, color: colors.muted, marginTop: 5 }, feedbackPrivacy: { fontSize: 12, lineHeight: 20, color: colors.muted2, textAlign: 'center', marginTop: 16, marginHorizontal: 14 },
  error: { backgroundColor: colors.dangerSoft, padding: 18, borderRadius: 16, marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 10 }, errorText: { color: colors.danger, fontSize: 14, lineHeight: 22, flex: 1 },
})
