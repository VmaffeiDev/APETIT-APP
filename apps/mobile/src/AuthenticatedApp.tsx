import { useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import DemoApp from './DemoApp'
import PrescriptionReview from './PrescriptionReview'
import { AuthPerson, OnboardingOptions, updateProfile } from './authApi'
import { colors, radius } from './theme'

export default function AuthenticatedApp({ token, person, options, onPersonChange, onLogout }: {
  token: string
  person: AuthPerson
  options: OnboardingOptions | null
  onPersonChange: (person: AuthPerson) => void
  onLogout: () => Promise<void>
}) {
  const [accountOpen, setAccountOpen] = useState(false)
  const [prescriptionOpen, setPrescriptionOpen] = useState(false)
  const [name, setName] = useState(person.name ?? '')
  const [unitId, setUnitId] = useState(person.unit_id ?? '')
  const [sector, setSector] = useState(person.sector ?? '')
  const [goal, setGoal] = useState(person.goal ?? 'seguir_prescricao')
  const [restrictions, setRestrictions] = useState<string[]>(person.restrictions ?? [])
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)

  function toggleRestriction(value: string) {
    setRestrictions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  async function save() {
    if (!name.trim() || !unitId) return
    setBusy(true); setMessage('')
    try {
      const updated = await updateProfile({ token, name: name.trim(), unitId, sector, goal, restrictions })
      onPersonChange(updated)
      setMessage('Perfil atualizado com sucesso.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.')
    } finally { setBusy(false) }
  }

  if (prescriptionOpen) {
    return <PrescriptionReview personId={person.id} onClose={() => setPrescriptionOpen(false)} />
  }

  if (!accountOpen) {
    return <View style={styles.appWrap}>
      <DemoApp />
      <View style={styles.quickActions}>
        <Pressable style={styles.prescriptionButton} onPress={() => setPrescriptionOpen(true)}><Text style={styles.prescriptionButtonText}>Prescrição</Text></Pressable>
        <Pressable style={styles.accountButton} onPress={() => setAccountOpen(true)}><Text style={styles.accountButtonText}>Perfil</Text></Pressable>
      </View>
    </View>
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}><Pressable onPress={() => setAccountOpen(false)} style={styles.backButton}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.topTitle}>Apetit</Text><View style={styles.settingsButton}><Text style={styles.settingsText}>⚙</Text></View></View>
      <Text style={styles.pageTitle}>Perfil</Text>
      <View style={styles.identity}><View style={styles.avatar}><Text style={styles.avatarText}>{(name || person.email).slice(0,2).toUpperCase()}</Text></View><View style={{flex:1}}><Text style={styles.personName}>{name || 'Seu nome'}</Text><Text style={styles.personMeta}>{person.email}</Text><Text style={styles.personMeta}>{sector || 'Setor não informado'}</Text></View></View>

      <Text style={styles.sectionLabel}>DADOS PESSOAIS</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>Nome</Text><TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Seu nome" placeholderTextColor={colors.muted2}/>
        <Text style={styles.label}>Setor</Text><TextInput style={styles.input} value={sector} onChangeText={setSector} placeholder="Ex.: Administrativo" placeholderTextColor={colors.muted2}/>
      </View>

      <Text style={styles.sectionLabel}>MINHA PRESCRIÇÃO</Text>
      <Pressable style={styles.prescriptionCard} onPress={() => setPrescriptionOpen(true)}><View style={styles.prescriptionIcon}><Text style={styles.prescriptionIconText}>✦</Text></View><View style={{flex:1}}><Text style={styles.prescriptionTitle}>Prescrição nutricional</Text><Text style={styles.prescriptionText}>Enviar documento, revisar OCR e confirmar os dados usados nas recomendações.</Text></View><Text style={styles.arrow}>›</Text></Pressable>

      <Text style={styles.sectionLabel}>EMPRESA / UNIDADE</Text>
      <View style={styles.choiceList}>{options?.units.map((item) => <Pressable key={item.unit_id} style={[styles.choice, unitId === item.unit_id && styles.choiceActive]} onPress={() => setUnitId(item.unit_id)}><View style={{flex:1}}><Text style={[styles.choiceTitle, unitId === item.unit_id && styles.choiceTitleActive]}>{item.company_name}</Text><Text style={styles.choiceText}>{item.unit_name}</Text></View><Text style={[styles.check, unitId === item.unit_id && styles.checkActive]}>{unitId === item.unit_id ? '✓' : '○'}</Text></Pressable>)}</View>

      <Text style={styles.sectionLabel}>OBJETIVO</Text>
      <View style={styles.choiceList}>{[
        ['seguir_prescricao', 'Seguir minha prescrição'],
        ['alimentacao_equilibrada', 'Manter o equilíbrio'],
        ['melhorar_habitos', 'Melhorar meus hábitos'],
      ].map(([value, label]) => <Pressable key={value} style={[styles.choice, goal === value && styles.choiceActive]} onPress={() => setGoal(value)}><Text style={[styles.choiceTitle, goal === value && styles.choiceTitleActive]}>{label}</Text><Text style={[styles.check, goal === value && styles.checkActive]}>{goal === value ? '✓' : '○'}</Text></Pressable>)}</View>

      <Text style={styles.sectionLabel}>RESTRIÇÕES ALIMENTARES</Text>
      <View style={styles.tags}>{['gluten','lactose','amendoim','castanhas','ovo','soja'].map((item) => <Pressable key={item} style={[styles.tag, restrictions.includes(item) && styles.tagActive]} onPress={() => toggleRestriction(item)}><Text style={[styles.tagText, restrictions.includes(item) && styles.tagTextActive]}>{restrictions.includes(item) ? '⚠ ' : ''}{item}</Text></Pressable>)}</View>

      {!!message && <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View>}
      <Pressable style={styles.primary} onPress={save} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Salvando...' : 'Salvar alterações'}</Text></Pressable>

      <View style={styles.privateCard}><Text style={styles.privateTitle}>🔒 Privacidade</Text><Text style={styles.privateText}>Sua prescrição, restrições e histórico alimentar continuam privados. O painel corporativo não exibe esses dados individualmente.</Text></View>
      <Pressable style={styles.logout} onPress={onLogout}><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  appWrap:{flex:1,backgroundColor:colors.bg},quickActions:{position:'absolute',right:14,top:78,zIndex:50,flexDirection:'row',gap:7},accountButton:{backgroundColor:colors.red,paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill},accountButtonText:{fontSize:10,fontWeight:'900',color:colors.white},prescriptionButton:{backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:colors.border,paddingHorizontal:12,paddingVertical:8,borderRadius:radius.pill},prescriptionButtonText:{fontSize:10,fontWeight:'900',color:colors.text},safe:{flex:1,backgroundColor:colors.bg},content:{padding:18,paddingBottom:54},topRow:{height:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},backButton:{width:36,height:36,borderRadius:18,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},back:{fontSize:25,color:colors.text,marginTop:-2},topTitle:{fontSize:18,fontWeight:'900',color:colors.text},settingsButton:{width:36,height:36,borderRadius:18,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},settingsText:{fontSize:15,color:colors.text},pageTitle:{fontSize:28,fontWeight:'900',color:colors.text,marginTop:8},identity:{flexDirection:'row',gap:13,alignItems:'center',marginTop:16},avatar:{width:58,height:58,borderRadius:29,backgroundColor:'#59616E',alignItems:'center',justifyContent:'center'},avatarText:{fontSize:19,fontWeight:'900',color:colors.white},personName:{fontSize:16,fontWeight:'900',color:colors.text},personMeta:{fontSize:10,color:colors.muted,marginTop:3},sectionLabel:{fontSize:10,fontWeight:'900',letterSpacing:1.2,color:colors.muted,marginTop:22,marginBottom:9},panel:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:14},label:{fontSize:10,fontWeight:'800',color:colors.muted,marginBottom:6,marginTop:8},input:{minHeight:46,borderRadius:12,backgroundColor:colors.surfaceAlt,borderWidth:1,borderColor:colors.border,paddingHorizontal:13,fontSize:13,color:colors.text},prescriptionCard:{flexDirection:'row',alignItems:'center',gap:12,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.lg,padding:14},prescriptionIcon:{width:42,height:42,borderRadius:13,backgroundColor:colors.red,alignItems:'center',justifyContent:'center'},prescriptionIconText:{fontSize:18,color:colors.white},prescriptionTitle:{fontSize:13,fontWeight:'900',color:colors.text},prescriptionText:{fontSize:10,lineHeight:15,color:colors.muted,marginTop:3},arrow:{fontSize:24,color:colors.muted2},choiceList:{gap:8},choice:{minHeight:58,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:13,flexDirection:'row',alignItems:'center'},choiceActive:{borderColor:colors.red,backgroundColor:'#1A1115'},choiceTitle:{fontSize:12,fontWeight:'800',color:colors.text,flex:1},choiceTitleActive:{color:colors.white},choiceText:{fontSize:10,color:colors.muted,marginTop:2},check:{fontSize:16,color:colors.muted2},checkActive:{color:colors.red},tags:{flexDirection:'row',flexWrap:'wrap',gap:8},tag:{paddingHorizontal:12,paddingVertical:9,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},tagActive:{backgroundColor:colors.dangerSoft,borderColor:colors.danger},tagText:{fontSize:10,color:colors.muted,textTransform:'capitalize'},tagTextActive:{color:'#FF9AA6'},message:{backgroundColor:colors.greenSoft,borderRadius:radius.md,padding:12,marginTop:16,borderWidth:1,borderColor:'#205E42'},messageText:{fontSize:11,color:colors.green},primary:{backgroundColor:colors.yellow,minHeight:52,borderRadius:radius.md,alignItems:'center',justifyContent:'center',marginTop:20},primaryText:{fontWeight:'900',color:'#101010',fontSize:12},privateCard:{backgroundColor:colors.surface,borderRadius:radius.md,padding:14,marginTop:14,borderWidth:1,borderColor:colors.border},privateTitle:{fontSize:12,fontWeight:'900',color:colors.text},privateText:{fontSize:10,lineHeight:16,color:colors.muted,marginTop:5},logout:{minHeight:50,borderRadius:radius.md,borderWidth:1,borderColor:'#622633',backgroundColor:colors.dangerSoft,alignItems:'center',justifyContent:'center',marginTop:22},logoutText:{fontWeight:'900',color:colors.danger,fontSize:11}
})