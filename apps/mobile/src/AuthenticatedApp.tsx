import { useState } from 'react'
import { Ionicons } from '@expo/vector-icons'
import { Pressable, SafeAreaView, StyleSheet, Text, TextInput, View } from 'react-native'

import DemoApp from './DemoApp'
import PrescriptionReview from './PrescriptionReview'
import { AuthPerson, OnboardingOptions, updateProfile } from './authApi'
import { Palette, useTheme, useThemedStyles } from './theme'
import { AppShell, AppTab } from './AppShell'

export default function AuthenticatedApp({ token, person, options, onPersonChange, onLogout }: {
  token: string
  person: AuthPerson
  options: OnboardingOptions | null
  onPersonChange: (person: AuthPerson) => void
  onLogout: () => Promise<void>
}) {
  const { colors, mode, setMode } = useTheme()
  const styles = useThemedStyles(makeStyles)
  const [initialTab, setInitialTab] = useState<AppTab>('home')
  const isDemo = /^visitante\.[0-9a-f]{32}@apetit\.local$/.test(person.email)
  const [accountOpen, setAccountOpen] = useState(false)
  const [prescriptionOpen, setPrescriptionOpen] = useState(false)
  const [name, setName] = useState(person.name ?? '')
  const [unitId, setUnitId] = useState(person.unit_id ?? '')
  const [sector, setSector] = useState(person.sector ?? '')
  const [goal, setGoal] = useState(person.goal ?? 'seguir_prescricao')
  const [restrictions, setRestrictions] = useState<string[]>(person.restrictions ?? [])
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<'success'|'error'>('success')
  const [busy, setBusy] = useState(false)

  function toggleRestriction(value: string) {
    setRestrictions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  async function save() {
    if (!name.trim()) {
      setMessageType('error')
      setMessage('Informe seu nome para salvar o perfil.')
      return
    }
    if (!unitId) {
      setMessageType('error')
      setMessage('Selecione uma empresa / unidade para salvar o perfil.')
      return
    }

    setBusy(true); setMessage('')
    try {
      const updated = await updateProfile({ token, name: name.trim(), unitId, sector, goal, restrictions })
      onPersonChange(updated)
      setMessageType('success')
      setMessage('Perfil atualizado com sucesso.')
    } catch (error) {
      setMessageType('error')
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.')
    } finally { setBusy(false) }
  }

  if (prescriptionOpen) return <PrescriptionReview personId={person.id} onClose={() => setPrescriptionOpen(false)} />
  const assignedUnit = options?.units.find((item) => item.unit_id === person.unit_id)
  if (!accountOpen && assignedUnit?.restaurant_id) return <DemoApp initialTab={initialTab} isDemo={isDemo} key={assignedUnit.unit_id} goal={person.goal} onProfile={() => setAccountOpen(true)} units={[{id: assignedUnit.unit_id, restaurantId: assignedUnit.restaurant_id, company: assignedUnit.company_name, label: assignedUnit.unit_name}]} />
  if (!accountOpen) return <SafeAreaView style={styles.safe}><View style={styles.content}>
    <Text style={styles.pageTitle}>Minha unidade</Text>
    <Text style={styles.privateText}>{!options ? 'Não foi possível confirmar sua unidade ainda. Aguarde ou entre novamente.' : 'Sua unidade ou refeitório ainda precisa ser vinculado pela administração.'}</Text>
    <Pressable accessibilityRole="button" style={styles.primary} onPress={() => setAccountOpen(true)}><Text style={styles.primaryText}>Abrir perfil</Text></Pressable>
    <Pressable accessibilityRole="button" style={styles.logout} onPress={onLogout}><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
  </View></SafeAreaView>

  return <AppShell active="profile" name={person.name || 'Visitante'} unitName={assignedUnit?.company_name} isDemo={isDemo} busy={busy}
    onNavigate={tab => { if (tab !== 'profile') { setInitialTab(tab); setAccountOpen(false) } }}>
    <View style={styles.profile}>
      <Text style={styles.kicker}>DO SEU JEITO</Text>
      <Text style={styles.pageTitle}>Perfil</Text>
      <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{(name || person.email).slice(0,2).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.personName}>{name || 'Seu nome'}</Text><Text style={styles.personMeta}>{isDemo ? 'Conta de demonstração' : person.email}</Text><Text style={styles.personMeta}>{sector || 'Setor não informado'}</Text></View></View>
      <View style={styles.accountStatus}><Ionicons name="checkmark-circle" size={14} color={colors.green}/><Text style={styles.accountStatusText}>Sessão autenticada</Text></View>

      <Text style={styles.sectionLabel}>APARÊNCIA</Text>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Escolha como quer ver a Apetit</Text>
        <Text style={styles.panelDescription}>Sua preferência fica salva neste dispositivo.</Text>
        <View accessibilityRole="radiogroup" accessibilityLabel="Aparência do aplicativo" style={styles.themeRow}>
          {([{ value: 'light', label: 'Claro', icon: 'sunny-outline' }, { value: 'dark', label: 'Escuro', icon: 'moon-outline' }] as const).map(theme =>
            <Pressable key={theme.value} accessibilityRole="radio" accessibilityLabel={`Tema ${theme.label.toLowerCase()}`} accessibilityState={{ checked: mode === theme.value }}
              onPress={() => setMode(theme.value)} style={[styles.themeChoice, mode === theme.value && styles.choiceActive]}>
              <Ionicons name={theme.icon} size={23} color={mode === theme.value ? colors.red : colors.muted}/>
              <Text style={[styles.choiceTitle, mode === theme.value && styles.choiceTitleActive]}>{theme.label}</Text>
            </Pressable>)}
        </View>
      </View>

      <Text style={styles.sectionLabel}>DADOS PESSOAIS</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>Nome</Text><TextInput accessibilityLabel="Nome" style={styles.input} value={name} onChangeText={(value)=>{setName(value);if(message)setMessage('')}} placeholder="Seu nome" placeholderTextColor={colors.muted2}/>
        <Text style={styles.label}>Setor</Text><TextInput accessibilityLabel="Setor" style={styles.input} value={sector} onChangeText={(value)=>{setSector(value);if(message)setMessage('')}} placeholder="Ex.: Administrativo" placeholderTextColor={colors.muted2}/>
      </View>

      <Text style={styles.sectionLabel}>MINHA PRESCRIÇÃO</Text>
      <Pressable accessibilityRole="button" style={styles.prescriptionCard} onPress={() => setPrescriptionOpen(true)}><View style={styles.prescriptionIcon}><Ionicons name="document-text-outline" size={20} color="#fff"/></View><View style={{flex:1}}><Text style={styles.prescriptionTitle}>Prescrição nutricional</Text><Text style={styles.prescriptionText}>Envie seu documento e revise as informações antes de confirmar.</Text></View><Ionicons name="chevron-forward" size={19} color={colors.muted2}/></Pressable>

      <Text style={styles.sectionLabel}>EMPRESA / UNIDADE</Text>
      <View style={styles.choiceList}>{options?.units.map((item) => <Pressable accessibilityRole="button" key={item.unit_id} style={[styles.choice, unitId === item.unit_id && styles.choiceActive]} onPress={() => { setUnitId(item.unit_id); if(message)setMessage('') }}><View style={{flex:1}}><Text style={[styles.choiceTitle, unitId === item.unit_id && styles.choiceTitleActive]}>{item.company_name}</Text><Text style={styles.choiceText}>{item.unit_name}</Text></View><Ionicons name={unitId === item.unit_id ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={unitId === item.unit_id ? colors.red : colors.muted2}/></Pressable>)}</View>

      <Text style={styles.sectionLabel}>OBJETIVO</Text>
      <View style={styles.choiceList}>{[
        ['seguir_prescricao', 'Seguir minha prescrição'],
        ['alimentacao_equilibrada', 'Manter o equilíbrio'],
        ['melhorar_habitos', 'Melhorar meus hábitos'],
      ].map(([value, label]) => <Pressable accessibilityRole="button" key={value} style={[styles.choice, goal === value && styles.choiceActive]} onPress={() => { setGoal(value); if(message)setMessage('') }}><Text style={[styles.choiceTitle, goal === value && styles.choiceTitleActive]}>{label}</Text><Ionicons name={goal === value ? 'checkmark-circle' : 'ellipse-outline'} size={18} color={goal === value ? colors.red : colors.muted2}/></Pressable>)}</View>

      <Text style={styles.sectionLabel}>RESTRIÇÕES ALIMENTARES</Text>
      <View style={styles.tags}>{['gluten','lactose','amendoim','castanhas','ovo','soja'].map((item) => <Pressable accessibilityRole="button" key={item} style={[styles.tag, restrictions.includes(item) && styles.tagActive]} onPress={() => toggleRestriction(item)}><View style={styles.tagInner}>{restrictions.includes(item) && <Ionicons name="warning-outline" size={13} color={colors.danger}/>}<Text style={[styles.tagText, restrictions.includes(item) && styles.tagTextActive]}>{item === 'gluten' ? 'Glúten' : item}</Text></View></Pressable>)}</View>

      {!!message && <View style={[styles.message,messageType==='error'&&styles.messageError]}><Ionicons name={messageType==='error'?'alert-circle-outline':'checkmark-circle-outline'} size={17} color={messageType==='error'?colors.danger:colors.green}/><Text style={[styles.messageText,messageType==='error'&&styles.messageErrorText]}>{message}</Text></View>}
      <Pressable accessibilityRole="button" style={styles.primary} onPress={save} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Salvando...' : 'Salvar alterações'}</Text></Pressable>

      <View style={styles.privateCard}><View style={styles.privateTitleRow}><Ionicons name="lock-closed-outline" size={15} color={colors.text}/><Text style={styles.privateTitle}>Privacidade</Text></View><Text style={styles.privateText}>Sua prescrição, restrições e histórico alimentar continuam privados. O painel corporativo não exibe esses dados individualmente.</Text></View>
      <Pressable accessibilityRole="button" style={styles.logout} onPress={onLogout}><View style={styles.tagInner}><Ionicons name="log-out-outline" size={17} color={colors.danger}/><Text style={styles.logoutText}>Sair da conta</Text></View></Pressable>
    </View>
  </AppShell>
}

const makeStyles = (colors: Palette) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg }, content: { padding: 28, maxWidth: 720, width: '100%', alignSelf: 'center' },
  profile: { width: '100%', maxWidth: 760, alignSelf: 'center' }, kicker: { fontSize: 11, letterSpacing: 1.5, fontWeight: '600', color: colors.muted },
  pageTitle: { fontSize: 30, lineHeight: 38, fontWeight: '700', color: colors.text, letterSpacing: -0.9, marginTop: 5 },
  identity: { flexDirection: 'row', gap: 17, alignItems: 'center', marginTop: 24 }, avatar: { width: 66, height: 66, borderRadius: 22, backgroundColor: colors.greenSoft, alignItems: 'center', justifyContent: 'center' }, avatarText: { fontSize: 22, fontWeight: '600', color: colors.green },
  personName: { fontSize: 20, lineHeight: 28, fontWeight: '600', color: colors.text }, personMeta: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 3 },
  accountStatus: { alignSelf: 'flex-start', marginTop: 14, backgroundColor: colors.greenSoft, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 7 }, accountStatusText: { fontSize: 12, fontWeight: '500', color: colors.green },
  sectionLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1.2, color: colors.muted, marginTop: 28, marginBottom: 12 },
  panel: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 20 }, panelTitle: { fontSize: 16, lineHeight: 23, fontWeight: '600', color: colors.text }, panelDescription: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 5 },
  themeRow: { flexDirection: 'row', gap: 12, marginTop: 18 }, themeChoice: { flex: 1, minHeight: 62, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: colors.border, flexDirection: 'row', alignItems: 'center', gap: 9 },
  label: { fontSize: 14, fontWeight: '500', color: colors.text, marginBottom: 8, marginTop: 10 }, input: { minHeight: 52, borderRadius: 12, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, fontSize: 16, color: colors.text, marginBottom: 10 },
  prescriptionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 20, padding: 20 }, prescriptionIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }, prescriptionTitle: { fontSize: 16, fontWeight: '600', color: colors.text }, prescriptionText: { fontSize: 13, lineHeight: 21, color: colors.muted, marginTop: 5 },
  choiceList: { gap: 10 }, choice: { minHeight: 64, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 15, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 9 }, choiceActive: { borderColor: colors.red, backgroundColor: colors.redSoft }, choiceTitle: { fontSize: 15, lineHeight: 22, fontWeight: '500', color: colors.text, flex: 1 }, choiceTitleActive: { color: colors.red, fontWeight: '600' }, choiceText: { fontSize: 13, lineHeight: 20, color: colors.muted, marginTop: 3 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 }, tag: { minHeight: 44, paddingHorizontal: 15, paddingVertical: 12, borderRadius: 24, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border }, tagActive: { backgroundColor: colors.dangerSoft, borderColor: colors.danger }, tagInner: { flexDirection: 'row', alignItems: 'center', gap: 7 }, tagText: { fontSize: 13, color: colors.muted, textTransform: 'capitalize' }, tagTextActive: { color: colors.danger },
  message: { backgroundColor: colors.greenSoft, borderRadius: 16, padding: 18, marginTop: 20, flexDirection: 'row', alignItems: 'center', gap: 10 }, messageText: { fontSize: 14, lineHeight: 22, color: colors.green, flex: 1 }, messageError: { backgroundColor: colors.dangerSoft }, messageErrorText: { color: colors.danger },
  primary: { backgroundColor: colors.brand, minHeight: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 24 }, primaryText: { fontWeight: '600', color: colors.white, fontSize: 15 },
  privateCard: { backgroundColor: colors.surface, borderRadius: 18, padding: 20, marginTop: 20, borderWidth: 1, borderColor: colors.border }, privateTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 }, privateTitle: { fontSize: 15, fontWeight: '600', color: colors.text }, privateText: { fontSize: 13, lineHeight: 22, color: colors.muted, marginTop: 8 },
  logout: { minHeight: 52, borderRadius: 14, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center', marginTop: 24, marginBottom: 12 }, logoutText: { fontWeight: '600', color: colors.danger, fontSize: 14 },
})
