import { useMemo, useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { StatusBar } from 'expo-status-bar'
import {
  ActivityIndicator,
  Image,
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

type DemoAppProps = { goal?: string | null; onProfile?: () => void }

const today = () => { const now = new Date(); const y = now.getFullYear(); const m = String(now.getMonth()+1).padStart(2,'0'); const d = String(now.getDate()).padStart(2,'0'); return `${y}-${m}-${d}` }
const fmt = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${Math.round(value)}${suffix}`
const fmtPortion = (quantity: number, unit?: string | null) => { const q = Number(quantity); const cleanUnit = unit?.trim() || 'porção'; return q === 1 ? cleanUnit : `${Number.isInteger(q) ? q : q.toFixed(1)}× ${cleanUnit}` }
const shortDate = (value: string) => new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(new Date(`${value}T12:00:00`)).replace('.', '')
const weekday = () => new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date())

const foodPhotos = [
  'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1569058242253-92a9c755a0ec?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1512058564366-18510be2db19?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=240&q=80',
  'https://images.unsplash.com/photo-1607532941433-304659e8198a?auto=format&fit=crop&w=240&q=80',
]
const platePhoto = 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=520&q=85'

export default function DemoApp({ goal, onProfile }: DemoAppProps) {
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
  const [registeredMeal, setRegisteredMeal] = useState<{ itemCount:number; kcal:number|null } | null>(null)
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

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />
      <View style={styles.topBar}>
        <Pressable onPress={goHome} style={styles.topIcon}><Ionicons name={screen === 'home' ? 'information-circle-outline' : 'chevron-back'} size={21} color={colors.text}/></Pressable>
        <View style={styles.topCenter}><Text style={styles.brand}>Apetit</Text><Text style={styles.date}>{weekday()}</Text></View>
        <Pressable style={styles.topIcon}><Ionicons name="notifications-outline" size={20} color={colors.text}/></Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {screen === 'home' && <Home
          unitId={unitId}
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

        {screen === 'progress' && <ProgressScreen progress={progress} history={history}/>} 

        {screen === 'feedback' && <FeedbackScreen registeredMeal={registeredMeal} foodRating={foodRating} setFoodRating={setFoodRating} serviceRating={serviceRating} setServiceRating={setServiceRating} tags={tags} toggleTag={toggleTag} comment={comment} setComment={setComment} onSend={sendFeedback}/>} 

        {screen === 'done' && <View style={styles.done}><View style={styles.doneIcon}><Ionicons name="checkmark" size={38} color="#07130D"/></View><Text style={styles.doneTitle}>Refeição registrada!</Text><Text style={styles.doneText}>Sua avaliação foi enviada e seu progresso já foi atualizado.</Text><View style={styles.rewardCard}><Ionicons name="sparkles-outline" size={20} color={colors.yellow}/><View style={styles.flex}><Text style={styles.rewardTitle}>+5 pontos</Text><Text style={styles.rewardText}>Registro e feedback concluídos hoje.</Text></View></View><Pressable style={styles.primary} onPress={openProgress}><Text style={styles.primaryText}>Ver meu progresso atualizado</Text></Pressable><Pressable style={styles.secondary} onPress={goHome}><Text style={styles.secondaryText}>Voltar ao início</Text></Pressable></View>}

        {!!error && <View style={styles.error}><Ionicons name="alert-circle-outline" size={17} color="#FF9BA7"/><Text style={styles.errorText}>{error}</Text></View>}
        {busy && <ActivityIndicator style={{ marginTop: 18 }} color={colors.red}/>} 
      </ScrollView>

      <BottomNav screen={screen} onHome={goHome} onMenu={openMenu} onPlate={() => openBuilder(false)} onProgress={openProgress} onProfile={() => onProfile?.()}/>
    </SafeAreaView>
  )
}

function Home({ unitId, setUnitId, onMenu, onRecommendation, onBuilder, onProgress, onFeedback }: { unitId:string;setUnitId:(id:string)=>void;onMenu:()=>void;onRecommendation:()=>void;onBuilder:()=>void;onProgress:()=>void;onFeedback:()=>void }) {
  return <>
    <View style={styles.homeHero}>
      <View style={styles.homeHeroTop}><View><Text style={styles.homeBrand}>Apetit</Text><Text style={styles.homeTag}>ALIMENTA O QUE TE FAZ BEM</Text></View><Ionicons name="sparkles-outline" size={28} color="#fff"/></View>
    </View>
    <Text style={styles.homeSubtitle}>Escolhas hoje, um amanhã melhor</Text>

    <View style={styles.achievementCard}>
      <View style={styles.iconSquare}><Ionicons name="trophy-outline" size={21} color="#fff"/></View>
      <View style={styles.flex}><Text style={styles.achievementTitle}>Minhas conquistas</Text><Achievement text="Atingiu a meta de proteína do dia"/><Achievement text="Registrou a refeição"/><Achievement text="Incluiu salada ou fruta no prato"/></View>
      <View style={styles.scoreRing}><Text style={styles.score}>25</Text><Text style={styles.scoreLabel}>PONTOS</Text></View>
    </View>

    <Pressable style={styles.heroAction} onPress={onBuilder}><View style={styles.actionLeft}><Ionicons name="restaurant-outline" size={20} color="#111"/><Text style={styles.heroActionText}>Montar meu prato</Text></View><Ionicons name="chevron-forward" size={21} color="#111"/></Pressable>
    <Pressable style={styles.darkAction} onPress={onRecommendation}><View style={styles.actionLeft}><Ionicons name="scale-outline" size={19} color={colors.yellow}/><Text style={styles.darkActionText}>Quanto pegar hoje</Text></View><Ionicons name="chevron-forward" size={20} color={colors.muted}/></Pressable>

    <View style={styles.quickHeader}><View><Text style={styles.quickTitle}>Ações rápidas</Text><Text style={styles.quickHint}>FACILITA O SEU DIA</Text></View></View>
    <View style={styles.quickGrid}>
      <Pressable style={styles.quickCard} onPress={onMenu}><View style={styles.quickIcon}><Ionicons name="calendar-outline" size={20} color="#fff"/></View><Text style={styles.quickText}>Cardápio</Text><Ionicons name="chevron-forward" size={15} color={colors.muted}/></Pressable>
      <Pressable style={styles.quickCard} onPress={onFeedback}><View style={styles.quickIcon}><Ionicons name="star-outline" size={20} color="#fff"/></View><Text style={styles.quickText}>Avaliar o refeitório</Text><Ionicons name="chevron-forward" size={15} color={colors.muted}/></Pressable>
    </View>

    <Text style={styles.sectionLabel}>UNIDADE</Text>
    <View style={styles.unitRow}>{DEMO_UNITS.map((item)=><Pressable key={item.id} style={[styles.chip, unitId===item.id&&styles.chipActive]} onPress={()=>setUnitId(item.id)}><Text style={[styles.chipText,unitId===item.id&&styles.chipTextActive]}>{item.company}</Text></Pressable>)}</View>
    <Pressable style={styles.progressShortcut} onPress={onProgress}><View><Text style={styles.progressShortcutText}>Seu progresso da semana</Text><Text style={styles.progressShortcutSub}>Veja pontos, refeições e metas</Text></View><Ionicons name="arrow-forward-circle-outline" size={25} color={colors.red}/></Pressable>
  </>
}

function Achievement({ text }: { text:string }) { return <View style={styles.achievementRow}><Ionicons name="checkmark-circle" size={14} color={colors.red}/><Text style={styles.achievementLine}>{text}</Text></View> }

function MenuScreen({ menu, unitName, onBuilder, onRecommendation }: { menu:PublishedMenu|null; unitName:string; onBuilder:()=>void; onRecommendation:()=>void }) {
  const [filter, setFilter] = useState<'todos'|'proteinas'|'carboidratos'|'saladas'>('todos')
  const filteredItems = (menu?.items ?? []).filter((item) => {
    if (filter === 'todos') return true
    if (filter === 'proteinas') return item.category === 'prato_principal'
    if (filter === 'carboidratos') return ['arroz','guarnicao'].includes(item.category)
    return item.category === 'salada'
  })
  return <>
    <Text style={styles.kicker}>CARDÁPIO DO DIA</Text><Text style={styles.pageTitle}>Cardápio de hoje</Text><Text style={styles.pageSub}>{unitName} · almoço</Text>
    <View style={styles.filterRow}>
      <Filter active={filter==='todos'} label="Todos" onPress={()=>setFilter('todos')}/>
      <Filter active={filter==='proteinas'} label="Proteínas" onPress={()=>setFilter('proteinas')}/>
      <Filter active={filter==='carboidratos'} label="Carboidratos" onPress={()=>setFilter('carboidratos')}/>
      <Filter active={filter==='saladas'} label="Saladas" onPress={()=>setFilter('saladas')}/>
    </View>
    {filteredItems.length > 0 ? <View style={styles.listCard}>{filteredItems.map((item, index) => <View key={item.id} style={styles.menuRow}>
      <Image source={{uri:foodPhotos[index%foodPhotos.length]}} style={styles.foodThumb}/>
      <View style={styles.flex}><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'} · {fmt(item.kcal, ' kcal')}</Text></View>
      <StatusPill index={index}/><Ionicons name="chevron-forward" size={16} color={colors.muted2}/>
    </View>)}</View> : <View style={styles.emptyState}><Ionicons name="restaurant-outline" size={28} color={colors.muted2}/><Text style={styles.emptyStateTitle}>Nenhum item nesta categoria</Text><Text style={styles.emptyStateText}>Veja outra categoria ou escolha “Todos”.</Text></View>}
    <Pressable style={styles.primary} onPress={onBuilder}><View style={styles.buttonInner}><Ionicons name="restaurant-outline" size={18} color="#111"/><Text style={styles.primaryText}>Montar meu prato</Text></View></Pressable>
    <Pressable style={styles.secondary} onPress={onRecommendation}><Text style={styles.secondaryText}>Ver recomendação automática</Text></Pressable>
  </>
}
function RecommendationScreen({ recommendation, goal, onSave, onCustomize }: { recommendation:Recommendation; goal?:string|null; onSave:()=>void; onCustomize:()=>void }) {
  const goalLabel = goal === 'seguir_prescricao' ? 'seguir minha prescrição' : goal === 'melhorar_habitos' ? 'melhorar meus hábitos' : 'manter o equilíbrio'
  return <>
    <Text style={styles.pageTitle}>Quanto pegar hoje</Text><Text style={styles.pageSub}>{recommendation.presentation_mode ? 'Simulação de como a Apetit combina sua prescrição com o cardápio disponível.' : 'Sugestão baseada na sua prescrição e no cardápio disponível.'}</Text>
    {recommendation.status === 'insufficient_data' ? <View style={styles.warning}><Text style={styles.warningTitle}>Ainda não dá para calcular com segurança</Text><Text style={styles.warningText}>{recommendation.message}</Text></View> : <>
      <View style={styles.suggestionCard}>
        <Text style={styles.suggestionLabel}>{recommendation.presentation_mode ? 'DEMONSTRAÇÃO · PRATO SUGERIDO' : 'SEU PRATO SUGERIDO HOJE'}</Text>
        <View style={styles.suggestionMain}><Image source={{uri:platePhoto}} style={styles.platePhoto}/><View style={styles.flex}><Text style={styles.suggestionKcal}>{fmt(recommendation.estimated_totals?.kcal, ' kcal')}</Text><Text style={styles.suggestionProtein}>{fmt(recommendation.estimated_totals?.protein_g, ' g de proteína')}</Text><View style={styles.goalRow}><Ionicons name="radio-button-on" size={14} color={colors.yellow}/><Text style={styles.goal}>Objetivo · {goalLabel}</Text></View></View></View>
      </View>
      <Text style={styles.sectionLabel}>SUAS PORÇÕES</Text>
      <View style={styles.listCard}>{recommendation.items.map((item, index) => <View key={item.menu_item_id} style={styles.portionRow}><Text style={styles.portionName}>{item.name}</Text><View style={[styles.portionPill,index===recommendation.items.length-1&&styles.greenPill]}><Text style={styles.portionPillText}>{item.portion ?? '1 porção'}</Text></View></View>)}</View>
      <View style={styles.estimate}><Text style={styles.estimateStrong}>Estimativa: {fmt(recommendation.estimated_totals?.kcal,' kcal')} · {fmt(recommendation.estimated_totals?.protein_g,' g de proteína')}</Text><Text style={styles.estimateText}>Essa sugestão considera seu objetivo e as opções disponíveis hoje.</Text></View>
      <Pressable style={styles.primary} onPress={onSave}><View style={styles.buttonInner}><Ionicons name="checkmark-circle-outline" size={18} color="#111"/><Text style={styles.primaryText}>Vou pegar isso — registrar</Text></View></Pressable>
      <Pressable style={styles.secondary} onPress={onCustomize}><View style={styles.buttonInner}><Ionicons name="restaurant-outline" size={17} color={colors.text}/><Text style={styles.secondaryText}>Montar do meu jeito</Text></View></Pressable>
      <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>
    </>}
  </>
}

function BuilderScreen({ menu, selected, selectedCount, setQuantity, onEvaluate, plate, onSave }: { menu:PublishedMenu|null; selected:SelectedMap; selectedCount:number; setQuantity:(id:string,q:number)=>void; onEvaluate:()=>void; plate:PlateEvaluation|null; onSave:()=>void }) {
  const items = menu?.items ?? []

  return <>
    <Text style={styles.pageTitle}>Montar meu prato</Text>
    <Text style={styles.pageSub}>Ajuste suas porções e confira como o prato se aproxima da sua meta.</Text>

    <View style={styles.builderSummary}>
      <View>
        <Text style={styles.builderCount}>{selectedCount}</Text>
        <Text style={styles.builderLabel}>itens selecionados</Text>
      </View>
      <Ionicons name="restaurant-outline" size={32} color={colors.yellow}/>
    </View>

    {items.length > 0 ? (
      <View style={styles.listCard}>
        {items.map((item) => {
          const quantity = selected[item.id] ?? 0
          return (
            <View key={item.id} style={styles.builderRow}>
              <View style={styles.flex}>
                <Text style={styles.menuName}>{item.name}</Text>
                <Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'} · {fmt(item.kcal,' kcal')}</Text>
              </View>
              <View style={styles.stepper}>
                <Pressable style={styles.stepButton} onPress={()=>setQuantity(item.id,quantity-1)}>
                  <Ionicons name="remove" size={18} color={colors.text}/>
                </Pressable>
                <Text style={styles.quantity}>{quantity}</Text>
                <Pressable style={styles.stepButton} onPress={()=>setQuantity(item.id,quantity+1)}>
                  <Ionicons name="add" size={18} color={colors.text}/>
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

    <Pressable style={styles.primary} onPress={onEvaluate}>
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
          <Pressable style={styles.primary} onPress={onSave}>
            <Text style={styles.primaryText}>Registrar este prato</Text>
          </Pressable>
        )}
      </View>
    )}
  </>
}

function ProgressScreen({ progress, history }: { progress:MealProgress|null; history:MealHistory|null }) {
  const series=(progress?.series??[]).slice(-5)
  const maxKcal=Math.max(...series.map((d)=>d.totals.kcal??0),1)
  const demoPoints=(progress?.meal_days ?? 0)*5
  return <>
    <Text style={styles.pageTitle}>Meu progresso</Text><Text style={styles.pageSub}>Pequenas escolhas, grandes resultados.</Text>
    <View style={styles.pointsCard}><View style={styles.pointsRing}><Text style={styles.pointsNumber}>{demoPoints}</Text></View><View style={styles.flex}><Text style={styles.pointsTitle}>pontos acumulados</Text><Text style={styles.pointsText}>{demoPoints ? 'Você ganhou pontos ao registrar sua refeição. Continue assim.' : 'Registre sua primeira refeição para começar a pontuar.'}</Text></View></View>
    <View style={styles.segment}><View style={styles.segmentActive}><Text style={styles.segmentActiveText}>Semana</Text></View><Text style={styles.segmentText}>Mês</Text><Text style={styles.segmentText}>Ano</Text></View>
    <View style={styles.chart}>{series.length?series.map((day,i)=>{const height=32+Math.round(((day.totals.kcal??0)/maxKcal)*78);return <View key={day.date} style={styles.barWrap}><Text style={styles.barValue}>{fmt(day.totals.kcal)}</Text><View style={styles.barTrack}><View style={[styles.bar,{height},i===series.length-2&&styles.barYellow]}/></View><Text style={styles.barLabel}>{shortDate(day.date)}</Text></View>}):<Text style={styles.emptyText}>Registre refeições para visualizar o gráfico semanal.</Text>}</View>
    <View style={styles.statGrid}><Stat icon="fitness-outline" value={`${progress?.adherent_days ?? 0}/${progress?.meal_days ?? 0}`} label="Dias dentro da faixa"/><Stat icon="restaurant-outline" value={`${progress?.meal_days ?? 0}`} label="Refeições registradas"/></View>
    <Text style={styles.sectionLabel}>REFEIÇÕES RECENTES</Text>
    <View style={styles.listCard}>{history?.meals.length?history.meals.slice(0,4).map((meal)=><View key={meal.meal_id} style={styles.historyBlock}><View style={styles.historyHeader}><Text style={styles.weekDate}>{new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(new Date(`${meal.meal_date}T12:00:00`))}</Text><Text style={styles.historyTotal}>{fmt(meal.totals.kcal,' kcal')}</Text></View>{meal.items.map((item,index)=><View key={`${meal.meal_id}-${index}`} style={styles.historyItemRow}><Ionicons name="checkmark-circle" size={13} color={colors.green}/><Text style={styles.historyItem}>{item.item_name} · {fmtPortion(item.quantity,item.unit)}</Text></View>)}</View>):<Text style={styles.emptyText}>Ainda não há refeições registradas.</Text>}</View>
  </>
}

function FeedbackScreen({ registeredMeal, foodRating, setFoodRating, serviceRating, setServiceRating, tags, toggleTag, comment, setComment, onSend }: { registeredMeal:{itemCount:number;kcal:number|null}|null; foodRating:number; setFoodRating:(v:number)=>void; serviceRating:number; setServiceRating:(v:number)=>void; tags:string[]; toggleTag:(v:string)=>void; comment:string; setComment:(v:string)=>void; onSend:()=>void }) {
  return <>
    {registeredMeal && <View style={styles.mealSavedBanner}>
      <View style={styles.mealSavedIcon}><Ionicons name="checkmark" size={18} color="#07130D"/></View>
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
    <View style={styles.tags}>{['sabor','temperatura','variedade','atendimento','outro'].map((tag)=><Pressable key={tag} style={[styles.tag,tags.includes(tag)&&styles.tagActive]} onPress={()=>toggleTag(tag)}><Text style={[styles.tagText,tags.includes(tag)&&styles.tagTextActive]}>{tag}</Text></Pressable>)}</View>
    <TextInput style={styles.input} placeholder="Quer acrescentar algo? (opcional)" placeholderTextColor={colors.muted2} multiline value={comment} onChangeText={setComment}/>
    <Pressable style={styles.primary} onPress={onSend}><View style={styles.buttonInner}><Ionicons name="send-outline" size={17} color="#111"/><Text style={styles.primaryText}>Enviar avaliação</Text></View></Pressable>
    <Text style={styles.feedbackPrivacy}>Seus dados pessoais, restrições e prescrição não aparecem nos relatórios corporativos.</Text>
  </>
}

function Filter({label,active=false,onPress}:{label:string;active?:boolean;onPress:()=>void}) { return <Pressable onPress={onPress} style={[styles.filter,active&&styles.filterActive]}><Text style={[styles.filterText,active&&styles.filterTextActive]}>{label}</Text></Pressable> }
function StatusPill({index}:{index:number}) { const green=index===1||index===4||index===5; return <View style={[styles.statusPill,green&&styles.statusGreen]}><Text style={[styles.statusText,green&&styles.statusGreenText]}>{green?'Leve':'Moderado'}</Text></View> }
function Mood({icon,label,active,danger=false,onPress}:{icon:keyof typeof Ionicons.glyphMap;label:string;active:boolean;danger?:boolean;onPress:()=>void}) { return <Pressable onPress={onPress} style={[styles.mood,active&&styles.moodActive,danger&&active&&styles.moodDanger]}><Ionicons name={icon} size={38} color={danger&&active?colors.danger:active?colors.green:colors.muted}/><Text style={styles.moodLabel}>{label}</Text></Pressable> }
function MacroGrid({ totals }: { totals?: { kcal:number|null;protein_g:number|null;carbs_g:number|null;fat_g:number|null } }) { return <View style={styles.metrics}><Metric label="Energia" value={fmt(totals?.kcal,' kcal')}/><Metric label="Proteína" value={fmt(totals?.protein_g,' g')}/><Metric label="Carboidratos" value={fmt(totals?.carbs_g,' g')}/><Metric label="Gorduras" value={fmt(totals?.fat_g,' g')}/></View> }
function Metric({label,value}:{label:string;value:string}) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
function Stat({icon,value,label}:{icon:keyof typeof Ionicons.glyphMap;value:string;label:string}) { return <View style={styles.stat}><Ionicons name={icon} size={20} color={colors.red}/><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View> }
function Rating({title,value,onChange}:{title:string;value:number;onChange:(v:number)=>void}) { return <View style={styles.ratingCard}><Text style={styles.fieldTitle}>{title}</Text><View style={styles.ratingRow}>{[1,2,3,4,5].map(n=><Pressable key={n} style={[styles.rating,value===n&&styles.ratingActive]} onPress={()=>onChange(n)}><Text style={[styles.ratingText,value===n&&styles.ratingTextActive]}>{n}</Text></Pressable>)}</View></View> }

function BottomNav({screen,onHome,onMenu,onPlate,onProgress,onProfile}:{screen:Screen;onHome:()=>void;onMenu:()=>void;onPlate:()=>void;onProgress:()=>void;onProfile:()=>void}) {
  const active=(key:string)=>screen===key||(key==='plate'&&(screen==='builder'||screen==='recommendation'))
  return <View style={styles.nav}><NavItem icon="home-outline" activeIcon="home" label="Início" active={active('home')} onPress={onHome}/><NavItem icon="calendar-outline" activeIcon="calendar" label="Cardápio" active={active('menu')} onPress={onMenu}/><NavItem icon="restaurant-outline" activeIcon="restaurant" label="Meu prato" active={active('plate')} onPress={onPlate}/><NavItem icon="stats-chart-outline" activeIcon="stats-chart" label="Progresso" active={active('progress')} onPress={onProgress}/><NavItem icon="person-outline" activeIcon="person" label="Perfil" active={false} onPress={onProfile}/></View>
}
function NavItem({icon,activeIcon,label,active,onPress}:{icon:keyof typeof Ionicons.glyphMap;activeIcon:keyof typeof Ionicons.glyphMap;label:string;active:boolean;onPress:()=>void}) { return <Pressable style={styles.navItem} onPress={onPress}><Ionicons name={active?activeIcon:icon} size={20} color={active?colors.red:colors.muted2}/><Text style={[styles.navLabel,active&&styles.navActive]}>{label}</Text>{active&&<View style={styles.navDot}/>}</Pressable> }

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},flex:{flex:1},topBar:{height:74,paddingHorizontal:18,flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderBottomWidth:1,borderBottomColor:colors.borderSoft},topCenter:{alignItems:'center'},brand:{fontSize:19,fontWeight:'900',color:colors.text},date:{fontSize:10,color:colors.muted,marginTop:2,textTransform:'capitalize'},topIcon:{width:36,height:36,borderRadius:18,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},content:{padding:18,paddingBottom:110},homeHero:{backgroundColor:colors.red,borderRadius:radius.lg,padding:20,marginBottom:12,...shadow},homeHeroTop:{flexDirection:'row',justifyContent:'space-between',alignItems:'center'},homeBrand:{fontSize:26,fontWeight:'900',color:'#fff'},homeTag:{fontSize:8,fontWeight:'900',letterSpacing:1.5,color:'#fff',marginTop:4},homeSubtitle:{fontSize:13,color:colors.muted,marginBottom:14},achievementCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:15,flexDirection:'row',alignItems:'center',gap:12,...shadow},iconSquare:{width:42,height:42,borderRadius:13,backgroundColor:colors.red,alignItems:'center',justifyContent:'center'},achievementTitle:{fontSize:15,fontWeight:'900',color:colors.text,marginBottom:7},achievementRow:{flexDirection:'row',alignItems:'center',gap:5,marginTop:3},achievementLine:{fontSize:10,color:'#D6DAE0',flex:1},scoreRing:{width:76,height:76,borderRadius:38,borderWidth:5,borderColor:colors.yellow,alignItems:'center',justifyContent:'center'},score:{fontSize:24,fontWeight:'900',color:colors.text},scoreLabel:{fontSize:8,fontWeight:'900',color:colors.muted,letterSpacing:1},heroAction:{minHeight:58,borderRadius:radius.md,backgroundColor:colors.yellow,marginTop:16,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},actionLeft:{flexDirection:'row',alignItems:'center',gap:9},heroActionText:{fontSize:16,fontWeight:'900',color:'#111'},darkAction:{minHeight:54,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,marginTop:10,paddingHorizontal:16,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},darkActionText:{fontSize:14,fontWeight:'800',color:colors.text},quickHeader:{marginTop:22,flexDirection:'row',justifyContent:'space-between'},quickTitle:{fontSize:16,fontWeight:'900',color:colors.text},quickHint:{fontSize:9,letterSpacing:1.6,color:colors.muted2,marginTop:3},quickGrid:{flexDirection:'row',gap:10,marginTop:10},quickCard:{flex:1,minHeight:82,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,padding:12,flexDirection:'row',alignItems:'center',gap:8},quickIcon:{width:36,height:36,borderRadius:11,backgroundColor:colors.red,alignItems:'center',justifyContent:'center'},quickText:{fontSize:11,fontWeight:'800',color:colors.text,flex:1},sectionLabel:{fontSize:10,fontWeight:'900',letterSpacing:1.4,color:colors.muted,marginTop:22,marginBottom:10},unitRow:{flexDirection:'row',flexWrap:'wrap',gap:8},chip:{paddingHorizontal:12,paddingVertical:9,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},chipActive:{backgroundColor:colors.red,borderColor:colors.red},chipText:{fontSize:11,fontWeight:'800',color:colors.muted},chipTextActive:{color:colors.white},progressShortcut:{marginTop:14,backgroundColor:colors.surface,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,padding:14,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},progressShortcutText:{fontSize:12,fontWeight:'800',color:colors.text},progressShortcutSub:{fontSize:9,color:colors.muted,marginTop:3},kicker:{fontSize:10,fontWeight:'900',letterSpacing:1.6,color:colors.muted,marginTop:2},pageTitle:{fontSize:30,fontWeight:'900',color:colors.text,marginTop:5},pageSub:{fontSize:13,lineHeight:19,color:colors.muted,marginTop:6,marginBottom:16},filterRow:{flexDirection:'row',gap:7,marginBottom:12,flexWrap:'wrap'},filter:{paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},filterActive:{backgroundColor:colors.red,borderColor:colors.red},filterText:{fontSize:10,fontWeight:'800',color:colors.muted},filterTextActive:{color:colors.white},emptyState:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:28,alignItems:'center',justifyContent:'center'},emptyStateTitle:{fontSize:13,fontWeight:'900',color:colors.text,marginTop:10},emptyStateText:{fontSize:10,lineHeight:15,color:colors.muted,textAlign:'center',marginTop:5,maxWidth:260},listCard:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,overflow:'hidden'},menuRow:{minHeight:72,padding:10,flexDirection:'row',alignItems:'center',gap:10,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},foodThumb:{width:50,height:50,borderRadius:13,backgroundColor:colors.surfaceAlt},menuName:{fontSize:14,fontWeight:'800',color:colors.text},menuMeta:{fontSize:10,color:colors.muted,marginTop:3},statusPill:{paddingHorizontal:8,paddingVertical:5,borderRadius:radius.pill,backgroundColor:colors.yellowSoft,borderWidth:1,borderColor:'#6C5B13'},statusGreen:{backgroundColor:colors.greenSoft,borderColor:'#206E4A'},statusText:{fontSize:9,fontWeight:'900',color:colors.yellow},statusGreenText:{color:colors.green},suggestionCard:{backgroundColor:'#241D0D',borderRadius:radius.lg,borderWidth:1,borderColor:'#7C6517',padding:14},suggestionLabel:{fontSize:9,fontWeight:'900',letterSpacing:1.2,color:'#F1E7C0'},suggestionMain:{flexDirection:'row',gap:14,alignItems:'center',marginTop:10},platePhoto:{width:112,height:86,borderRadius:18},suggestionKcal:{fontSize:22,fontWeight:'900',color:colors.text},suggestionProtein:{fontSize:14,fontWeight:'800',color:colors.text,marginTop:2},goalRow:{flexDirection:'row',gap:5,alignItems:'center',marginTop:9},goal:{fontSize:10,color:colors.yellow},portionRow:{minHeight:48,paddingHorizontal:14,flexDirection:'row',alignItems:'center',borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},portionName:{flex:1,fontSize:12,color:colors.text},portionPill:{backgroundColor:colors.surfaceAlt,paddingHorizontal:9,paddingVertical:5,borderRadius:radius.pill},greenPill:{backgroundColor:colors.greenSoft},portionPillText:{fontSize:10,fontWeight:'800',color:colors.text},estimate:{backgroundColor:colors.surfaceAlt,borderRadius:radius.md,padding:13,marginTop:12,borderWidth:1,borderColor:colors.border},estimateStrong:{fontSize:11,fontWeight:'900',color:colors.text},estimateText:{fontSize:10,lineHeight:15,color:colors.muted,marginTop:4},buttonInner:{flexDirection:'row',alignItems:'center',gap:8},primary:{backgroundColor:colors.yellow,minHeight:54,borderRadius:radius.md,alignItems:'center',justifyContent:'center',paddingHorizontal:16,marginTop:14},primaryText:{fontSize:13,fontWeight:'900',color:'#101010'},secondary:{backgroundColor:colors.surface,minHeight:50,borderRadius:radius.md,alignItems:'center',justifyContent:'center',borderWidth:1,borderColor:colors.border,marginTop:9},secondaryText:{fontSize:12,fontWeight:'800',color:colors.text},disclaimer:{fontSize:10,lineHeight:15,color:colors.muted2,textAlign:'center',margin:14},warning:{backgroundColor:colors.yellowSoft,borderRadius:radius.lg,padding:16,borderWidth:1,borderColor:'#665813'},warningTitle:{fontSize:14,fontWeight:'900',color:colors.yellow},warningText:{fontSize:12,lineHeight:18,color:'#D9CCA1',marginTop:5},builderSummary:{backgroundColor:colors.surface,borderRadius:radius.lg,borderWidth:1,borderColor:colors.border,padding:16,marginBottom:12,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},builderCount:{fontSize:36,fontWeight:'900',color:colors.yellow},builderLabel:{fontSize:11,color:colors.muted},builderRow:{minHeight:64,paddingHorizontal:13,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},stepper:{flexDirection:'row',alignItems:'center',gap:8},stepButton:{width:34,height:34,borderRadius:10,backgroundColor:colors.surfaceAlt,alignItems:'center',justifyContent:'center'},quantity:{minWidth:18,textAlign:'center',fontWeight:'900',color:colors.text},resultCard:{backgroundColor:colors.yellowSoft,borderRadius:radius.lg,padding:16,marginTop:14,borderWidth:1,borderColor:'#665813'},resultGood:{backgroundColor:colors.greenSoft,borderColor:'#1E6243'},resultBlocked:{backgroundColor:colors.dangerSoft,borderColor:'#6D2630'},resultTitleRow:{flexDirection:'row',alignItems:'center',gap:8},resultTitle:{fontSize:16,fontWeight:'900',color:colors.text},resultText:{fontSize:11,lineHeight:17,color:colors.muted,marginTop:5},metrics:{flexDirection:'row',flexWrap:'wrap',marginTop:12},metric:{width:'50%',paddingVertical:8},metricValue:{fontSize:18,fontWeight:'900',color:colors.text},metricLabel:{fontSize:10,color:colors.muted,marginTop:2},pointsCard:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:15,flexDirection:'row',gap:15,alignItems:'center'},pointsRing:{width:70,height:70,borderRadius:35,borderWidth:5,borderColor:colors.yellow,alignItems:'center',justifyContent:'center'},pointsNumber:{fontSize:23,fontWeight:'900',color:colors.text},pointsTitle:{fontSize:12,fontWeight:'900',color:colors.text},pointsText:{fontSize:10,lineHeight:15,color:colors.muted,marginTop:4},segment:{height:36,marginTop:14,borderRadius:10,backgroundColor:colors.surface,flexDirection:'row',alignItems:'center',padding:3},segmentActive:{flex:1,height:30,borderRadius:8,backgroundColor:colors.red,alignItems:'center',justifyContent:'center'},segmentActiveText:{fontSize:10,fontWeight:'900',color:colors.white},segmentText:{flex:1,textAlign:'center',fontSize:10,color:colors.muted},chart:{height:170,marginTop:16,backgroundColor:colors.surface,borderRadius:radius.md,borderWidth:1,borderColor:colors.border,flexDirection:'row',alignItems:'flex-end',justifyContent:'space-around',paddingHorizontal:10,paddingBottom:12,paddingTop:16},barWrap:{alignItems:'center',justifyContent:'flex-end',height:138},barValue:{fontSize:8,color:colors.muted,marginBottom:4},barTrack:{height:110,width:30,justifyContent:'flex-end',alignItems:'center'},bar:{width:26,borderRadius:5,backgroundColor:colors.red},barYellow:{backgroundColor:colors.yellow},barLabel:{fontSize:8,color:colors.muted,marginTop:5,textTransform:'capitalize'},statGrid:{flexDirection:'row',gap:10,marginTop:12},stat:{flex:1,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:13},statValue:{fontSize:18,fontWeight:'900',color:colors.text,marginTop:7},statLabel:{fontSize:9,color:colors.muted,marginTop:2},historyBlock:{padding:13,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:colors.border},historyHeader:{flexDirection:'row',justifyContent:'space-between'},weekDate:{fontSize:12,fontWeight:'900',color:colors.text},historyTotal:{fontSize:11,fontWeight:'900',color:colors.yellow},historyItemRow:{flexDirection:'row',gap:5,alignItems:'center',marginTop:5},historyItem:{fontSize:10,color:colors.muted,flex:1},emptyText:{fontSize:11,color:colors.muted,padding:14},feedbackQuestion:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:16},feedbackTitle:{fontSize:17,fontWeight:'900',color:colors.text},feedbackSub:{fontSize:11,lineHeight:16,color:colors.muted,marginTop:4},moodRow:{flexDirection:'row',gap:10,marginTop:12},mood:{flex:1,height:104,borderRadius:radius.md,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},moodActive:{backgroundColor:colors.greenSoft,borderColor:colors.green},moodDanger:{backgroundColor:colors.dangerSoft,borderColor:colors.danger},moodLabel:{fontSize:11,fontWeight:'900',color:colors.text,marginTop:5},ratingCard:{backgroundColor:colors.surface,borderRadius:radius.md,padding:14,marginTop:12,borderWidth:1,borderColor:colors.border},fieldTitle:{fontSize:12,fontWeight:'900',color:colors.text,marginTop:16,marginBottom:10},ratingRow:{flexDirection:'row',gap:8},rating:{width:42,height:42,borderRadius:12,backgroundColor:colors.surfaceAlt,alignItems:'center',justifyContent:'center'},ratingActive:{backgroundColor:colors.red},ratingText:{fontWeight:'900',color:colors.muted},ratingTextActive:{color:colors.white},tags:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:12},tag:{paddingHorizontal:11,paddingVertical:8,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},tagActive:{borderColor:colors.yellow,backgroundColor:colors.yellowSoft},tagText:{fontSize:10,color:colors.muted,textTransform:'capitalize'},tagTextActive:{color:colors.yellow},input:{backgroundColor:colors.surface,borderRadius:radius.md,minHeight:90,padding:13,textAlignVertical:'top',borderWidth:1,borderColor:colors.border,color:colors.text},done:{paddingTop:54,alignItems:'center'},doneIcon:{width:74,height:74,borderRadius:37,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'},doneTitle:{fontSize:23,fontWeight:'900',color:colors.text,marginTop:18,textAlign:'center'},doneText:{fontSize:12,lineHeight:18,color:colors.muted,textAlign:'center',marginTop:8,marginBottom:8},rewardCard:{width:'100%',marginTop:12,backgroundColor:colors.yellowSoft,borderWidth:1,borderColor:'#665813',borderRadius:radius.md,padding:13,flexDirection:'row',alignItems:'center',gap:10},rewardTitle:{fontSize:13,fontWeight:'900',color:colors.yellow},rewardText:{fontSize:10,color:colors.muted,marginTop:2},mealSavedBanner:{backgroundColor:colors.greenSoft,borderWidth:1,borderColor:'#1E6243',borderRadius:radius.md,padding:12,flexDirection:'row',alignItems:'center',gap:10,marginBottom:16},mealSavedIcon:{width:34,height:34,borderRadius:17,backgroundColor:colors.green,alignItems:'center',justifyContent:'center'},mealSavedTitle:{fontSize:12,fontWeight:'900',color:colors.green},mealSavedText:{fontSize:10,color:colors.muted,marginTop:2},feedbackPrivacy:{fontSize:9,lineHeight:14,color:colors.muted2,textAlign:'center',marginTop:12,marginHorizontal:20},error:{backgroundColor:colors.dangerSoft,padding:13,borderRadius:radius.md,marginTop:14,borderWidth:1,borderColor:'#6D2630',flexDirection:'row',alignItems:'center',gap:8},errorText:{color:'#FF9BA7',fontSize:11,flex:1},nav:{height:84,backgroundColor:'#0B0E11',borderTopWidth:1,borderTopColor:colors.border,flexDirection:'row',paddingHorizontal:4,paddingBottom:8},navItem:{flex:1,alignItems:'center',justifyContent:'center'},navLabel:{fontSize:8,color:colors.muted2,marginTop:4},navActive:{color:colors.red},navDot:{width:24,height:2,borderRadius:1,backgroundColor:colors.red,marginTop:4}
})
