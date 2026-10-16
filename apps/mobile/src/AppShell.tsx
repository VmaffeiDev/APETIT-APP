import { ReactNode, useEffect, useRef } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { ActivityIndicator, Platform, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native'
import { Palette, useTheme, useThemedStyles } from './theme'

export type AppTab = 'home' | 'menu' | 'plate' | 'progress' | 'profile'
const tabs: { id: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { id: 'home', label: 'Início', icon: 'home-outline' },
  { id: 'menu', label: 'Cardápio', icon: 'calendar-outline' },
  { id: 'plate', label: 'Meu prato', icon: 'restaurant-outline' },
  { id: 'progress', label: 'Progresso', icon: 'stats-chart-outline' },
  { id: 'profile', label: 'Perfil', icon: 'person-outline' },
]

export function AppShell({ children, active, screenKey, onNavigate, name = 'Visitante', unitName, isDemo, busy = false }: {
  children: ReactNode; active: AppTab; screenKey?: string; onNavigate: (tab: AppTab) => void
  name?: string; unitName?: string; isDemo?: boolean; busy?: boolean
}) {
  const { colors } = useTheme()
  const s = useThemedStyles(makeStyles)
  const { width } = useWindowDimensions()
  const desktop = width >= 900
  const scroll = useRef<ScrollView>(null)
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }) }, [screenKey, active])
  const date = new Intl.DateTimeFormat('pt-BR', { timeZone: 'America/Sao_Paulo', day: 'numeric', month: 'long' }).format(new Date())
  const nav = (vertical: boolean) => <View style={vertical ? s.railNav : s.bottomNav} accessibilityLabel="Navegação principal">
    {tabs.map(tab => <Pressable key={tab.id} accessibilityRole="button" accessibilityLabel={tab.label}
      accessibilityState={{ selected: active === tab.id, disabled: busy }} aria-current={active === tab.id ? 'page' : undefined} disabled={busy} onPress={() => onNavigate(tab.id)}
      style={({ pressed }) => [vertical ? s.railItem : s.navItem, vertical && active === tab.id && s.railActive, pressed && s.pressed]}>
      <View style={[s.navIcon, active === tab.id && s.navIconActive]}><Ionicons name={tab.icon} size={22} color={active === tab.id ? colors.red : colors.muted}/></View>
      <Text numberOfLines={1} style={[vertical ? s.railLabel : s.navLabel, active === tab.id && s.activeLabel]}>{tab.label}</Text>
      {vertical && active === tab.id && <View style={s.activeDot}/>}
    </Pressable>)}
  </View>
  return <SafeAreaView style={s.safe}>
    <View style={s.layout}>
      {desktop && <View style={s.rail}>
        <Brand/>
        <Text style={s.railCaption}>SUA ALIMENTAÇÃO, TODO DIA</Text>
        {nav(true)}
        <View style={s.railBottom}><Ionicons name="leaf-outline" size={28} color={colors.green}/><Text style={s.railBottomTitle}>Cuidar de você começa no prato.</Text><Text style={s.railBottomText}>Pequenas escolhas fazem parte de uma boa rotina.</Text></View>
        <Text style={s.railFoot}>Apetit · Alimenta o que te faz bem</Text>
      </View>}
      <View style={s.main}>
        <View style={[s.topbar, desktop && s.topbarDesktop]}>
          {desktop ? <View style={s.context}><Ionicons name="location-outline" size={18} color={colors.green}/><Text style={s.contextText}>{unitName || 'Minha alimentação'}</Text><Text style={s.contextDot}>/</Text><Text style={s.contextText}>Espaço do colaborador</Text></View> : <Brand/>}
          <View style={s.topRight}>
            {desktop && <Text style={s.date}>{date}</Text>}
            <Pressable accessibilityRole="button" accessibilityLabel="Abrir meu perfil" disabled={busy} onPress={() => onNavigate('profile')} style={s.avatar}><Text style={s.avatarText}>{name.trim().slice(0, 2).toUpperCase()}</Text></Pressable>
          </View>
        </View>
        <ScrollView ref={scroll} style={s.scroll} contentContainerStyle={[s.content, desktop && s.contentDesktop]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={s.page}>
            {isDemo && <View style={s.demo}><Ionicons name="information-circle-outline" size={17} color={colors.muted}/><Text style={s.demoText}><Text style={s.demoStrong}>Modo demonstração.</Text> Metas fictícias, sem prescrição nutricional.</Text></View>}
            <View pointerEvents={busy ? 'none' : 'auto'}>{children}</View>
          </View>
        </ScrollView>
        {busy && <View style={s.busy} accessibilityRole="progressbar" accessibilityLabel="Carregando"><ActivityIndicator color={colors.red}/><Text style={s.busyText}>Só um instante…</Text></View>}
        {!desktop && nav(false)}
      </View>
    </View>
  </SafeAreaView>
}

function Brand() {
  const { colors } = useTheme()
  const s = useThemedStyles(makeStyles)
 return <View style={s.brand}><View style={s.brandMark}><Ionicons name="restaurant" size={21} color={colors.white}/></View><Text style={s.brandText}>apetit<Text style={{ color: colors.red }}>.</Text></Text></View> }

/** Decorative illustration; does not represent a specific meal or recommended portions. */
export function PlateArt({ small = false }: { small?: boolean }) {
  const { colors } = useTheme()
  const s = useThemedStyles(makeStyles)

  return <View accessible={false} importantForAccessibility="no-hide-descendants" style={[s.art, small && { transform: [{ scale: 0.72 }], margin: -18 }]}>
    <View style={s.plate}><View style={s.plateInner}>
      <View style={s.rice}><View style={s.riceLine}/><View style={s.riceLine}/><View style={s.riceLine}/></View>
      <View style={s.leafOne}><Ionicons name="leaf" size={48} color="#4D8052"/></View><View style={s.leafTwo}><Ionicons name="leaf" size={43} color="#739A50"/></View>
      <View style={s.carrotOne}/><View style={s.carrotTwo}/><View style={s.tomato}/><View style={s.tomatoSmall}/>
    </View></View>
  </View>
}

export function FoodIcon({ category }: { category: string }) {
  const { colors } = useTheme()
  const s = useThemedStyles(makeStyles)

  const style = category === 'salada' ? { icon: 'leaf-outline' as const, bg: colors.greenSoft, fg: colors.green }
    : category === 'prato_principal' ? { icon: 'restaurant-outline' as const, bg: colors.redSoft, fg: colors.red }
    : category === 'sobremesa' ? { icon: 'nutrition-outline' as const, bg: colors.yellowSoft, fg: colors.yellow }
    : { icon: 'grid-outline' as const, bg: colors.yellowSoft, fg: colors.yellow }
  return <View style={[s.foodIcon, { backgroundColor: style.bg }]}><Ionicons name={style.icon} size={23} color={style.fg}/></View>
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, layout: { flex: 1, flexDirection: 'row' }, main: { flex: 1, minWidth: 0 },
  rail: { width: 232, backgroundColor: colors.surface, borderRightWidth: 1, borderColor: colors.border, padding: 24 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 9 }, brandMark: { width: 35, height: 35, backgroundColor: colors.brand, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  brandText: { fontSize: 29, fontWeight: '800', color: colors.text, letterSpacing: -1.2 }, railCaption: { fontSize: 10, letterSpacing: 1, color: colors.muted, marginTop: 16, marginBottom: 32 },
  railNav: { gap: 8 }, railItem: { minHeight: 50, borderRadius: 12, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }, railActive: { backgroundColor: colors.redSoft },
  railLabel: { fontSize: 14, color: colors.muted, fontWeight: '500', flex: 1 }, activeLabel: { color: colors.red, fontWeight: '700' }, activeDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.red },
  railBottom: { marginTop: 'auto', backgroundColor: colors.greenSoft, padding: 18, borderRadius: 18 }, railBottomTitle: { fontSize: 16, lineHeight: 23, color: colors.green, fontWeight: '600', marginTop: 10 }, railBottomText: { fontSize: 12, lineHeight: 19, color: colors.muted, marginTop: 9 }, railFoot: { fontSize: 10, color: colors.muted, marginTop: 22 },
  topbar: { minHeight: 72, paddingHorizontal: 20, backgroundColor: colors.surface, borderBottomWidth: 1, borderColor: colors.borderSoft, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, topbarDesktop: { paddingHorizontal: 36, minHeight: 80 },
  context: { flexDirection: 'row', alignItems: 'center', gap: 8 }, contextText: { fontSize: 13, color: colors.muted }, contextDot: { color: '#B8BBAF', marginHorizontal: 6 }, topRight: { flexDirection: 'row', alignItems: 'center', gap: 22 }, date: { fontSize: 13, color: colors.muted },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 12, color: colors.green, fontWeight: '700' },
  scroll: { flex: 1 }, content: { padding: 20, paddingBottom: 32 }, contentDesktop: { paddingHorizontal: 36, paddingVertical: 28, paddingBottom: 40 }, page: { width: '100%', maxWidth: 1000, alignSelf: 'center' },
  demo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 22 }, demoText: { flex: 1, fontSize: 12, lineHeight: 19, color: colors.muted }, demoStrong: { fontWeight: '600' },
  bottomNav: { minHeight: 74, backgroundColor: colors.surface, borderTopWidth: 1, borderColor: colors.border, flexDirection: 'row', paddingHorizontal: 6, paddingTop: 6, paddingBottom: Platform.OS === 'web' ? 12 : 8 },
  navItem: { flex: 1, minHeight: 54, alignItems: 'center', justifyContent: 'center' }, navIcon: { width: 44, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 10 }, navIconActive: { backgroundColor: colors.redSoft }, navLabel: { fontSize: 12, lineHeight: 17, color: colors.muted, marginTop: 3 }, pressed: { opacity: 0.65 },
  busy: { position: 'absolute', bottom: 92, alignSelf: 'center', backgroundColor: colors.surface, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', gap: 10, alignItems: 'center' }, busyText: { fontSize: 13, color: colors.muted },
  art: { width: 172, height: 172, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-12deg' }] }, plate: { width: 154, height: 154, borderRadius: 77, backgroundColor: '#FFFEFA', padding: 13, shadowColor: '#4B1621', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 3, height: 9 } }, plateInner: { flex: 1, borderRadius: 70, backgroundColor: '#F5F1E7', borderWidth: 1, borderColor: '#E8E3D5', overflow: 'hidden' },
  rice: { position: 'absolute', width: 66, height: 62, backgroundColor: '#E8DCBB', left: 9, top: 13, borderRadius: 25, padding: 14, gap: 7, transform: [{ rotate: '15deg' }] }, riceLine: { height: 3, width: 35, borderRadius: 2, backgroundColor: '#FFFCF2' },
  leafOne: { position: 'absolute', right: 2, top: 7, transform: [{ rotate: '-28deg' }] }, leafTwo: { position: 'absolute', right: 6, top: 44, transform: [{ rotate: '60deg' }] },
  carrotOne: { position: 'absolute', bottom: 20, left: 21, width: 16, height: 40, borderRadius: 8, backgroundColor: '#DE9550', transform: [{ rotate: '35deg' }] }, carrotTwo: { position: 'absolute', bottom: 11, left: 43, width: 16, height: 40, borderRadius: 8, backgroundColor: '#E5A455', transform: [{ rotate: '35deg' }] },
  tomato: { position: 'absolute', right: 25, bottom: 13, width: 24, height: 24, borderRadius: 12, backgroundColor: '#BC4C43', borderWidth: 3, borderColor: '#D86451' }, tomatoSmall: { position: 'absolute', right: 6, bottom: 33, width: 19, height: 19, borderRadius: 10, backgroundColor: '#BC4C43', borderWidth: 3, borderColor: '#D86451' }, foodIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
})
