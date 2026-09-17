import { useState } from 'react'
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import DemoApp from './DemoApp'
import { AuthPerson, OnboardingOptions, updateProfile } from './authApi'

export default function AuthenticatedApp({
  token,
  person,
  options,
  onPersonChange,
  onLogout,
}: {
  token: string
  person: AuthPerson
  options: OnboardingOptions | null
  onPersonChange: (person: AuthPerson) => void
  onLogout: () => Promise<void>
}) {
  const [accountOpen, setAccountOpen] = useState(false)
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
      setMessage('Perfil atualizado.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível atualizar o perfil.')
    } finally { setBusy(false) }
  }

  if (!accountOpen) {
    return <View style={styles.appWrap}>
      <DemoApp />
      <Pressable style={styles.accountButton} onPress={() => setAccountOpen(true)}>
        <Text style={styles.accountButtonText}>Perfil</Text>
      </Pressable>
    </View>
  }

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={() => setAccountOpen(false)}><Text style={styles.back}>‹ Voltar ao app</Text></Pressable>
      <Text style={styles.eyebrow}>CONTA</Text>
      <Text style={styles.title}>Seu perfil</Text>
      <Text style={styles.email}>{person.email}</Text>

      <Text style={styles.label}>Nome</Text>
      <TextInput style={styles.input} value={name} onChangeText={setName} />

      <Text style={styles.label}>Empresa / unidade</Text>
      <View style={styles.choiceList}>{options?.units.map((item) => <Pressable key={item.unit_id} style={[styles.choice, unitId === item.unit_id && styles.choiceActive]} onPress={() => setUnitId(item.unit_id)}><Text style={[styles.choiceTitle, unitId === item.unit_id && styles.choiceTitleActive]}>{item.company_name}</Text><Text style={[styles.choiceText, unitId === item.unit_id && styles.choiceTextActive]}>{item.unit_name}</Text></Pressable>)}</View>

      <Text style={styles.label}>Setor</Text>
      <TextInput style={styles.input} value={sector} onChangeText={setSector} placeholder="Ex.: Administrativo" />

      <Text style={styles.label}>Objetivo</Text>
      <View style={styles.choiceList}>{[
        ['seguir_prescricao', 'Seguir minha prescrição'],
        ['alimentacao_equilibrada', 'Alimentação equilibrada'],
        ['melhorar_habitos', 'Melhorar meus hábitos'],
      ].map(([value, label]) => <Pressable key={value} style={[styles.choice, goal === value && styles.choiceActive]} onPress={() => setGoal(value)}><Text style={[styles.choiceTitle, goal === value && styles.choiceTitleActive]}>{label}</Text></Pressable>)}</View>

      <Text style={styles.label}>Restrições / alergias</Text>
      <View style={styles.tags}>{['gluten','lactose','amendoim','castanhas','ovo','soja'].map((item) => <Pressable key={item} style={[styles.tag, restrictions.includes(item) && styles.tagActive]} onPress={() => toggleRestriction(item)}><Text style={[styles.tagText, restrictions.includes(item) && styles.tagTextActive]}>{item}</Text></Pressable>)}</View>

      {!!message && <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View>}
      <Pressable style={styles.primary} onPress={save} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Salvando...' : 'Salvar alterações'}</Text></Pressable>

      <View style={styles.privateCard}><Text style={styles.privateTitle}>Privacidade</Text><Text style={styles.privateText}>Sua prescrição, restrições e histórico alimentar continuam privados. O painel corporativo não exibe esses dados individualmente.</Text></View>

      <Pressable style={styles.logout} onPress={onLogout}><Text style={styles.logoutText}>Sair da conta</Text></Pressable>
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  appWrap:{flex:1},accountButton:{position:'absolute',right:18,top:54,zIndex:50,backgroundColor:'#D8B248',paddingHorizontal:13,paddingVertical:9,borderRadius:999,shadowColor:'#000',shadowOpacity:.08,shadowRadius:8,shadowOffset:{width:0,height:3}},accountButtonText:{fontSize:12,fontWeight:'900',color:'#171714'},safe:{flex:1,backgroundColor:'#F5F4F0'},content:{padding:22,paddingBottom:54},back:{fontSize:14,fontWeight:'800',color:'#706A60',marginBottom:24},eyebrow:{fontSize:11,letterSpacing:2,fontWeight:'900',color:'#9A792D'},title:{fontSize:34,fontWeight:'900',color:'#171714',marginTop:8},email:{fontSize:14,color:'#777168',marginTop:5,marginBottom:18},label:{fontSize:13,fontWeight:'900',color:'#4E4A43',marginTop:18,marginBottom:8},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E1DCD1',borderRadius:17,paddingHorizontal:16,minHeight:54,fontSize:16,color:'#171714'},choiceList:{gap:9},choice:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E1DCD1',borderRadius:18,padding:15},choiceActive:{backgroundColor:'#171714',borderColor:'#171714'},choiceTitle:{fontSize:14,fontWeight:'900',color:'#171714'},choiceTitleActive:{color:'#fff'},choiceText:{fontSize:12,color:'#777168',marginTop:3},choiceTextActive:{color:'#C8C2B6'},tags:{flexDirection:'row',flexWrap:'wrap',gap:8},tag:{paddingHorizontal:13,paddingVertical:10,borderRadius:999,backgroundColor:'#fff',borderWidth:1,borderColor:'#DED8CC'},tagActive:{backgroundColor:'#171714'},tagText:{fontSize:12,color:'#686258',textTransform:'capitalize'},tagTextActive:{color:'#fff'},primary:{backgroundColor:'#D8B248',minHeight:56,borderRadius:18,alignItems:'center',justifyContent:'center',marginTop:22},primaryText:{fontWeight:'900',color:'#171714'},message:{backgroundColor:'#EAF3EC',borderRadius:15,padding:12,marginTop:18},messageText:{fontSize:13,color:'#315039'},privateCard:{backgroundColor:'#EAF3EC',borderRadius:18,padding:16,marginTop:18},privateTitle:{fontSize:13,fontWeight:'900',color:'#314035'},privateText:{fontSize:12,lineHeight:18,color:'#657067',marginTop:5},logout:{minHeight:52,borderRadius:18,borderWidth:1,borderColor:'#D9B5B0',alignItems:'center',justifyContent:'center',marginTop:26},logoutText:{fontWeight:'900',color:'#8C2C22'}
})
