import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import DemoApp from './DemoApp'
import { AuthSession, getOnboardingOptions, OnboardingOptions, requestLoginCode, saveOnboarding, verifyLoginCode } from './authApi'
import { configureEmployeeContext } from './demo'

type Step = 'email' | 'code' | 'onboarding' | 'app'

export default function EmployeeEntry() {
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('mariana.demo@apetit.local')
  const [code, setCode] = useState('')
  const [demoCode, setDemoCode] = useState<string | undefined>()
  const [session, setSession] = useState<AuthSession | null>(null)
  const [options, setOptions] = useState<OnboardingOptions | null>(null)
  const [name, setName] = useState('')
  const [unitId, setUnitId] = useState('')
  const [sector, setSector] = useState('')
  const [goal, setGoal] = useState('seguir_prescricao')
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getOnboardingOptions().then(setOptions).catch(() => undefined)
  }, [])

  async function sendCode() {
    setBusy(true); setError('')
    try {
      const response = await requestLoginCode(email.trim())
      setDemoCode(response.demo_code)
      setStep('code')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível enviar o código.') }
    finally { setBusy(false) }
  }

  async function verify() {
    setBusy(true); setError('')
    try {
      const authenticated = await verifyLoginCode(email.trim(), code.trim())
      setSession(authenticated)
      setName(authenticated.person.name ?? '')
      setUnitId(authenticated.person.unit_id ?? options?.units[0]?.unit_id ?? '')
      if (authenticated.person.onboarding_completed && authenticated.person.name) {
        configureEmployeeContext({ id: authenticated.person.id, name: authenticated.person.name, unitId: authenticated.person.unit_id })
        setStep('app')
      } else {
        setStep('onboarding')
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Código inválido.') }
    finally { setBusy(false) }
  }

  async function finishOnboarding() {
    if (!session || !name.trim() || !unitId) return
    setBusy(true); setError('')
    try {
      await saveOnboarding({ token: session.access_token, name: name.trim(), unitId, sector, goal, restrictions })
      configureEmployeeContext({ id: session.person.id, name: name.trim(), unitId })
      setStep('app')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir o cadastro.') }
    finally { setBusy(false) }
  }

  function toggleRestriction(value: string) {
    setRestrictions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  if (step === 'app') return <DemoApp />

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.brand}>APETIT</Text>

        {step === 'email' && <>
          <Text style={styles.title}>Sua alimentação no trabalho, do seu jeito.</Text>
          <Text style={styles.subtitle}>Entre com seu e-mail para acessar cardápio, recomendações, histórico e controle nutricional.</Text>
          <Text style={styles.label}>E-mail</Text>
          <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" placeholder="voce@empresa.com.br" />
          <Pressable style={styles.primary} onPress={sendCode}><Text style={styles.primaryText}>Receber código de acesso</Text></Pressable>
          <View style={styles.note}><Text style={styles.noteTitle}>Sem senha fixa</Text><Text style={styles.noteText}>O acesso é feito por código temporário. Na demo local usamos um código conhecido para facilitar a apresentação.</Text></View>
        </>}

        {step === 'code' && <>
          <Text style={styles.back} onPress={() => setStep('email')}>‹ Voltar</Text>
          <Text style={styles.title}>Digite o código</Text>
          <Text style={styles.subtitle}>Enviamos um código temporário para {email}.</Text>
          {!!demoCode && <View style={styles.demoCode}><Text style={styles.demoCodeLabel}>CÓDIGO DA DEMO</Text><Text style={styles.demoCodeValue}>{demoCode}</Text></View>}
          <TextInput style={[styles.input, styles.codeInput]} value={code} onChangeText={setCode} keyboardType="number-pad" maxLength={6} placeholder="000000" />
          <Pressable style={styles.primary} onPress={verify}><Text style={styles.primaryText}>Entrar</Text></Pressable>
        </>}

        {step === 'onboarding' && <>
          <Text style={styles.eyebrow}>PRIMEIRO ACESSO</Text>
          <Text style={styles.title}>Vamos configurar seu perfil.</Text>
          <Text style={styles.subtitle}>Esses dados ajudam o app a mostrar o cardápio correto e aplicar suas preferências e restrições.</Text>

          <Text style={styles.label}>Como podemos te chamar?</Text>
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Seu nome" />

          <Text style={styles.label}>Empresa / unidade</Text>
          <View style={styles.choiceList}>{options?.units.map((item) => <Pressable key={item.unit_id} style={[styles.choice, unitId === item.unit_id && styles.choiceActive]} onPress={() => setUnitId(item.unit_id)}><Text style={[styles.choiceTitle, unitId === item.unit_id && styles.choiceTitleActive]}>{item.company_name}</Text><Text style={[styles.choiceText, unitId === item.unit_id && styles.choiceTextActive]}>{item.unit_name}</Text></Pressable>)}</View>

          <Text style={styles.label}>Setor</Text>
          <TextInput style={styles.input} value={sector} onChangeText={setSector} placeholder="Ex.: Administrativo" />

          <Text style={styles.label}>Seu objetivo</Text>
          <View style={styles.choiceList}>{[
            ['seguir_prescricao', 'Seguir minha prescrição'],
            ['alimentacao_equilibrada', 'Alimentação equilibrada'],
            ['melhorar_habitos', 'Melhorar meus hábitos'],
          ].map(([value, label]) => <Pressable key={value} style={[styles.smallChoice, goal === value && styles.choiceActive]} onPress={() => setGoal(value)}><Text style={[styles.choiceTitle, goal === value && styles.choiceTitleActive]}>{label}</Text></Pressable>)}</View>

          <Text style={styles.label}>Restrições ou alergias</Text>
          <View style={styles.tags}>{['gluten','lactose','amendoim','castanhas','ovo','soja'].map((item) => <Pressable key={item} style={[styles.tag, restrictions.includes(item) && styles.tagActive]} onPress={() => toggleRestriction(item)}><Text style={[styles.tagText, restrictions.includes(item) && styles.tagTextActive]}>{item}</Text></Pressable>)}</View>

          <View style={styles.privacy}><Text style={styles.noteTitle}>Privacidade</Text><Text style={styles.noteText}>Restrições, prescrições e histórico alimentar são dados pessoais do funcionário e não aparecem individualmente no painel da empresa.</Text></View>
          <Pressable style={styles.primary} onPress={finishOnboarding}><Text style={styles.primaryText}>Concluir e entrar no app</Text></Pressable>
        </>}

        {!!error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}
        {busy && <ActivityIndicator style={{ marginTop: 18 }} color="#171714" />}
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F5F4F0'},content:{padding:24,paddingTop:48,paddingBottom:60},brand:{fontSize:13,letterSpacing:4,fontWeight:'900',color:'#9A792D',marginBottom:44},eyebrow:{fontSize:11,letterSpacing:2,fontWeight:'900',color:'#9A792D'},title:{fontSize:36,lineHeight:40,fontWeight:'900',color:'#171714',marginTop:10},subtitle:{fontSize:15,lineHeight:22,color:'#756F65',marginTop:14,marginBottom:28},label:{fontSize:13,fontWeight:'900',color:'#4E4A43',marginTop:18,marginBottom:8},input:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E1DCD1',borderRadius:17,paddingHorizontal:16,minHeight:54,fontSize:16,color:'#171714'},codeInput:{fontSize:28,letterSpacing:9,textAlign:'center',fontWeight:'900'},primary:{backgroundColor:'#D8B248',minHeight:56,borderRadius:18,alignItems:'center',justifyContent:'center',marginTop:18,paddingHorizontal:16},primaryText:{fontWeight:'900',color:'#171714',fontSize:15},note:{backgroundColor:'#EEEAE2',borderRadius:18,padding:16,marginTop:18},privacy:{backgroundColor:'#EAF3EC',borderRadius:18,padding:16,marginTop:20},noteTitle:{fontSize:13,fontWeight:'900',color:'#314035'},noteText:{fontSize:12,lineHeight:18,color:'#657067',marginTop:5},back:{fontSize:15,fontWeight:'800',color:'#706A60',marginBottom:14},demoCode:{backgroundColor:'#171714',borderRadius:20,padding:20,alignItems:'center',marginBottom:18},demoCodeLabel:{fontSize:10,letterSpacing:2,fontWeight:'900',color:'#BDB7AA'},demoCodeValue:{fontSize:34,letterSpacing:8,fontWeight:'900',color:'#D8B248',marginTop:6},choiceList:{gap:9},choice:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E1DCD1',borderRadius:18,padding:15},smallChoice:{backgroundColor:'#fff',borderWidth:1,borderColor:'#E1DCD1',borderRadius:16,padding:14},choiceActive:{backgroundColor:'#171714',borderColor:'#171714'},choiceTitle:{fontSize:14,fontWeight:'900',color:'#171714'},choiceTitleActive:{color:'#fff'},choiceText:{fontSize:12,color:'#777168',marginTop:3},choiceTextActive:{color:'#C8C2B6'},tags:{flexDirection:'row',flexWrap:'wrap',gap:8},tag:{paddingHorizontal:13,paddingVertical:10,borderRadius:999,backgroundColor:'#fff',borderWidth:1,borderColor:'#DED8CC'},tagActive:{backgroundColor:'#171714'},tagText:{fontSize:12,color:'#686258',textTransform:'capitalize'},tagTextActive:{color:'#fff'},error:{backgroundColor:'#FFE6E3',padding:14,borderRadius:16,marginTop:16},errorText:{color:'#8C2C22',fontSize:13}
})
