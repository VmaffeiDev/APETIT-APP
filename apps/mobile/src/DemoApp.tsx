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
  getPublishedMenu,
  getRecommendation,
  PublishedMenu,
  Recommendation,
  registerMeal,
  submitFeedback,
} from './api'
import { DEMO_PERSON, DEMO_UNITS } from './demo'

type Screen = 'home' | 'menu' | 'recommendation' | 'feedback' | 'done'

const today = () => new Date().toISOString().slice(0, 10)
const fmt = (value: number | null | undefined, suffix = '') => value == null ? '—' : `${Math.round(value)}${suffix}`

export default function DemoApp() {
  const [screen, setScreen] = useState<Screen>('home')
  const [unitId, setUnitId] = useState(DEMO_UNITS[0].id)
  const [menu, setMenu] = useState<PublishedMenu | null>(null)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [foodRating, setFoodRating] = useState(5)
  const [serviceRating, setServiceRating] = useState(5)
  const [tags, setTags] = useState<string[]>([])
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const unit = useMemo(() => DEMO_UNITS.find((item) => item.id === unitId) ?? DEMO_UNITS[0], [unitId])

  async function openMenu() {
    setBusy(true); setError('')
    try {
      setMenu(await getPublishedMenu({ unitId, serviceDate: today() }))
      setScreen('menu')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível carregar o cardápio.')
    } finally { setBusy(false) }
  }

  async function openRecommendation() {
    setBusy(true); setError('')
    try {
      setRecommendation(await getRecommendation({ personId: DEMO_PERSON.id, unitId, serviceDate: today() }))
      setScreen('recommendation')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível montar sua recomendação.')
    } finally { setBusy(false) }
  }

  async function saveMeal() {
    if (!recommendation) return
    setBusy(true); setError('')
    try {
      await registerMeal({ personId: DEMO_PERSON.id, serviceDate: today(), recommendation })
      setScreen('feedback')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível registrar a refeição.')
    } finally { setBusy(false) }
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar sua avaliação.')
    } finally { setBusy(false) }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />
      <View style={styles.header}>
        <View><Text style={styles.brand}>APETIT</Text><Text style={styles.hello}>Olá, Mariana</Text></View>
        <View style={styles.avatar}><Text style={styles.avatarText}>M</Text></View>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {screen !== 'home' && screen !== 'done' && <Pressable onPress={() => setScreen('home')}><Text style={styles.back}>‹ Início</Text></Pressable>}

        {screen === 'home' && <>
          <View style={styles.hero}>
            <Text style={styles.eyebrow}>ALIMENTAÇÃO INTELIGENTE</Text>
            <Text style={styles.heroTitle}>Seu almoço, alinhado à sua meta.</Text>
            <Text style={styles.heroText}>Veja o cardápio disponível e receba uma combinação baseada na sua prescrição confirmada.</Text>
            <Pressable style={styles.primary} onPress={openRecommendation}><Text style={styles.primaryText}>Ver meu almoço de hoje</Text></Pressable>
          </View>
          <Text style={styles.sectionTitle}>Unidade da demonstração</Text>
          <View style={styles.unitRow}>{DEMO_UNITS.map((item) => <Pressable key={item.id} style={[styles.chip, unitId === item.id && styles.chipActive]} onPress={() => setUnitId(item.id)}><Text style={[styles.chipText, unitId === item.id && styles.chipTextActive]}>{item.company}</Text></Pressable>)}</View>
          <Pressable style={styles.card} onPress={openMenu}><Text style={styles.cardTitle}>Cardápio de hoje</Text><Text style={styles.cardText}>Veja tudo o que está disponível no refeitório.</Text><Text style={styles.arrow}>›</Text></Pressable>
          <View style={styles.privacy}><Text style={styles.privacyTitle}>Privacidade por padrão</Text><Text style={styles.privacyText}>Sua prescrição e seu histórico alimentar ficam privados. A empresa recebe apenas dados agregados.</Text></View>
        </>}

        {screen === 'menu' && <>
          <Text style={styles.pageTitle}>Cardápio de hoje</Text><Text style={styles.pageSub}>{unit.company} · almoço</Text>
          <View style={styles.listCard}>{menu?.items.map((item) => <View key={item.id} style={styles.menuRow}><View><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuMeta}>{item.standard_portion ?? 'Porção padrão'} · {fmt(item.kcal, ' kcal')}</Text></View><Text style={styles.category}>{item.category.replaceAll('_', ' ')}</Text></View>)}</View>
          <Pressable style={styles.primary} onPress={openRecommendation}><Text style={styles.primaryText}>Montar meu prato recomendado</Text></Pressable>
        </>}

        {screen === 'recommendation' && recommendation && <>
          <Text style={styles.pageTitle}>Seu almoço de hoje</Text><Text style={styles.pageSub}>{unit.company} · baseado na sua prescrição</Text>
          {recommendation.status === 'insufficient_data' ? <View style={styles.warning}><Text style={styles.warningTitle}>Ainda não dá para calcular com segurança</Text><Text style={styles.warningText}>{recommendation.message}</Text></View> : <>
            <View style={styles.listCard}>{recommendation.items.map((item) => <View key={item.menu_item_id} style={styles.recoRow}><View style={styles.dot}/><View><Text style={styles.menuName}>{item.name}</Text><Text style={styles.menuMeta}>{item.portion ?? 'Porção padrão'} · {fmt(item.kcal, ' kcal')}</Text></View></View>)}</View>
            <View style={styles.metrics}><Metric label="Energia" value={fmt(recommendation.estimated_totals?.kcal, ' kcal')} /><Metric label="Proteína" value={fmt(recommendation.estimated_totals?.protein_g, ' g')} /><Metric label="Carboidratos" value={fmt(recommendation.estimated_totals?.carbs_g, ' g')} /><Metric label="Gorduras" value={fmt(recommendation.estimated_totals?.fat_g, ' g')} /></View>
            <Pressable style={styles.primary} onPress={saveMeal}><Text style={styles.primaryText}>Comi este prato · registrar refeição</Text></Pressable>
            <Text style={styles.disclaimer}>{recommendation.disclaimer}</Text>
          </>}
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

        {screen === 'done' && <View style={styles.done}><View style={styles.doneIcon}><Text style={styles.doneCheck}>✓</Text></View><Text style={styles.doneTitle}>Refeição registrada</Text><Text style={styles.doneText}>Obrigado pelo feedback. Sua refeição já entrou no seu histórico e a avaliação será usada apenas de forma agregada no painel da Apetit.</Text><Pressable style={styles.primary} onPress={() => setScreen('home')}><Text style={styles.primaryText}>Voltar ao início</Text></Pressable></View>}

        {!!error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}
        {busy && <ActivityIndicator style={{ marginTop: 18 }} color="#151512" />}
      </ScrollView>
    </SafeAreaView>
  )
}

function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricValue}>{value}</Text><Text style={styles.metricLabel}>{label}</Text></View> }
function Rating({ title, value, onChange }: { title: string; value: number; onChange: (value: number) => void }) { return <View style={styles.ratingCard}><Text style={styles.fieldTitle}>{title}</Text><View style={styles.ratingRow}>{[1,2,3,4,5].map((n) => <Pressable key={n} style={[styles.rating, value === n && styles.ratingActive]} onPress={() => onChange(n)}><Text style={[styles.ratingText, value === n && styles.ratingTextActive]}>{n}</Text></Pressable>)}</View></View> }

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F5F4F0'},header:{padding:20,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},brand:{fontSize:12,letterSpacing:3,fontWeight:'900',color:'#78746B'},hello:{fontSize:24,fontWeight:'900',color:'#171714',marginTop:4},avatar:{width:42,height:42,borderRadius:21,backgroundColor:'#171714',alignItems:'center',justifyContent:'center'},avatarText:{color:'#fff',fontWeight:'900'},content:{padding:18,paddingBottom:44},hero:{backgroundColor:'#171714',borderRadius:28,padding:24},eyebrow:{color:'#D5D1C7',fontSize:11,fontWeight:'800',letterSpacing:1.7},heroTitle:{color:'#fff',fontSize:32,lineHeight:36,fontWeight:'900',marginTop:12},heroText:{color:'#CCC9C0',fontSize:15,lineHeight:22,marginTop:12,marginBottom:22},primary:{backgroundColor:'#D8B248',minHeight:54,borderRadius:18,alignItems:'center',justifyContent:'center',paddingHorizontal:18,marginTop:14},primaryText:{fontWeight:'900',color:'#171714'},sectionTitle:{fontSize:18,fontWeight:'900',marginTop:26,marginBottom:12,color:'#171714'},unitRow:{flexDirection:'row',gap:8,flexWrap:'wrap'},chip:{backgroundColor:'#fff',borderWidth:1,borderColor:'#DDD9CF',paddingHorizontal:14,paddingVertical:10,borderRadius:999},chipActive:{backgroundColor:'#171714'},chipText:{fontWeight:'800',color:'#6C675E'},chipTextActive:{color:'#fff'},card:{backgroundColor:'#fff',borderRadius:22,padding:18,marginTop:18,borderWidth:1,borderColor:'#E6E2D8'},cardTitle:{fontSize:17,fontWeight:'900',color:'#171714'},cardText:{fontSize:13,color:'#777168',marginTop:5},arrow:{position:'absolute',right:18,top:26,fontSize:28,color:'#A19A8D'},privacy:{backgroundColor:'#EAF3EC',borderRadius:20,padding:18,marginTop:14},privacyTitle:{fontWeight:'900',color:'#25432D'},privacyText:{fontSize:13,lineHeight:19,color:'#506755',marginTop:5},back:{fontSize:15,fontWeight:'800',color:'#6A655C',paddingVertical:8},pageTitle:{fontSize:30,fontWeight:'900',color:'#171714',marginTop:10},pageSub:{fontSize:14,color:'#777168',marginTop:7,marginBottom:18},listCard:{backgroundColor:'#fff',borderRadius:22,padding:16,borderWidth:1,borderColor:'#E6E2D8'},menuRow:{paddingVertical:13,borderBottomWidth:StyleSheet.hairlineWidth,borderBottomColor:'#E7E2D8'},menuName:{fontSize:16,fontWeight:'900',color:'#171714'},menuMeta:{fontSize:12,color:'#817B70',marginTop:3},category:{fontSize:11,color:'#A07E28',textTransform:'capitalize',marginTop:6,fontWeight:'800'},recoRow:{flexDirection:'row',alignItems:'center',paddingVertical:11},dot:{width:10,height:10,borderRadius:5,backgroundColor:'#D8B248',marginRight:12},metrics:{backgroundColor:'#fff',borderRadius:22,padding:18,marginTop:14,flexDirection:'row',flexWrap:'wrap'},metric:{width:'50%',marginBottom:14},metricValue:{fontSize:21,fontWeight:'900',color:'#171714'},metricLabel:{fontSize:12,color:'#817B70',marginTop:2},disclaimer:{fontSize:11,lineHeight:17,color:'#898379',textAlign:'center',margin:16},warning:{backgroundColor:'#FFF4D1',borderRadius:20,padding:18},warningTitle:{fontWeight:'900',color:'#5B4714'},warningText:{fontSize:13,lineHeight:19,color:'#766229',marginTop:6},ratingCard:{backgroundColor:'#fff',borderRadius:20,padding:18,marginBottom:12},fieldTitle:{fontSize:15,fontWeight:'900',color:'#171714',marginBottom:10},ratingRow:{flexDirection:'row',gap:9},rating:{width:45,height:45,borderRadius:14,backgroundColor:'#F0EEE8',alignItems:'center',justifyContent:'center'},ratingActive:{backgroundColor:'#171714'},ratingText:{fontWeight:'900',color:'#6C675E'},ratingTextActive:{color:'#fff'},tags:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},tag:{paddingHorizontal:12,paddingVertical:9,borderRadius:999,backgroundColor:'#fff',borderWidth:1,borderColor:'#DED9CE'},tagActive:{backgroundColor:'#171714'},tagText:{fontSize:12,color:'#6D675C'},tagTextActive:{color:'#fff'},input:{backgroundColor:'#fff',borderRadius:18,minHeight:100,padding:14,textAlignVertical:'top',borderWidth:1,borderColor:'#E3DED4'},done:{paddingTop:70,alignItems:'center'},doneIcon:{width:72,height:72,borderRadius:36,backgroundColor:'#D8B248',alignItems:'center',justifyContent:'center'},doneCheck:{fontSize:34,fontWeight:'900'},doneTitle:{fontSize:28,fontWeight:'900',color:'#171714',marginTop:18},doneText:{fontSize:14,lineHeight:21,color:'#706A61',textAlign:'center',marginTop:10,marginBottom:10},error:{backgroundColor:'#FFE6E3',padding:14,borderRadius:16,marginTop:16},errorText:{color:'#8C2C22',fontSize:13}
})
