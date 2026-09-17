import { useEffect, useState } from 'react'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import AuthenticatedApp from './AuthenticatedApp'
import { configureEmployeeAccessToken } from './api'
import { AuthPerson, AuthSession, getMe, getOnboardingOptions, logout, OnboardingOptions, requestLoginCode, saveOnboarding, verifyLoginCode } from './authApi'
import { configureEmployeeContext } from './demo'
import { clearStoredSession, loadStoredSession, saveStoredSession } from './sessionStore'
import { colors, radius } from './theme'

type Step = 'restoring' | 'email' | 'code' | 'onboarding' | 'app'

export default function EmployeeEntry() {
  const [step, setStep] = useState<Step>('restoring')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [demoCode, setDemoCode] = useState<string | undefined>()
  const [session, setSession] = useState<AuthSession | null>(null)
  const [person, setPerson] = useState<AuthPerson | null>(null)
  const [options, setOptions] = useState<OnboardingOptions | null>(null)
  const [name, setName] = useState('')
  const [unitId, setUnitId] = useState('')
  const [sector, setSector] = useState('')
  const [goal, setGoal] = useState('seguir_prescricao')
  const [restrictions, setRestrictions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    getOnboardingOptions()
      .then((loaded) => {
        setOptions(loaded)
        setUnitId((current) => current || loaded.units[0]?.unit_id || '')
      })
      .catch(() => undefined)
    restoreSession()
  }, [])

  function applyPerson(authenticatedPerson: AuthPerson, token: string) {
    setPerson(authenticatedPerson)
    configureEmployeeAccessToken(token)
    if (authenticatedPerson.name) {
      configureEmployeeContext({ id: authenticatedPerson.id, name: authenticatedPerson.name, unitId: authenticatedPerson.unit_id })
    }
  }

  async function restoreSession() {
    try {
      const stored = await loadStoredSession()
      if (!stored) { setStep('email'); return }
      const restoredPerson = await getMe(stored.access_token)
      const restored: AuthSession = { access_token: stored.access_token, expires_at: stored.expires_at, person: restoredPerson }
      setSession(restored)
      applyPerson(restoredPerson, stored.access_token)
      if (restoredPerson.onboarding_completed && restoredPerson.name) setStep('app')
      else {
        setName(restoredPerson.name ?? '')
        setUnitId(restoredPerson.unit_id ?? '')
        setSector(restoredPerson.sector ?? '')
        setGoal(restoredPerson.goal ?? 'seguir_prescricao')
        setRestrictions(restoredPerson.restrictions ?? [])
        setStep('onboarding')
      }
    } catch {
      await clearStoredSession()
      configureEmployeeAccessToken(null)
      setStep('email')
    }
  }

  async function sendCode() {
    const normalizedEmail = email.trim().toLowerCase()
    if (!normalizedEmail) {
      setError('Digite seu e-mail para continuar.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      setError('Digite um e-mail válido, como voce@gmail.com.')
      return
    }

    setBusy(true); setError('')
    try {
      const response = await requestLoginCode(normalizedEmail)
      setEmail(normalizedEmail)
      setDemoCode(response.demo_code)
      setStep('code')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar o código.')
    } finally { setBusy(false) }
  }

  async function verify() {
    setBusy(true); setError('')
    try {
      const authenticated = await verifyLoginCode(email.trim(), code.trim())
      setSession(authenticated); setPerson(authenticated.person); configureEmployeeAccessToken(authenticated.access_token)
      await saveStoredSession({ access_token: authenticated.access_token, expires_at: authenticated.expires_at })
      setName(authenticated.person.name ?? '')
      setUnitId(authenticated.person.unit_id ?? options?.units[0]?.unit_id ?? '')
      setSector(authenticated.person.sector ?? '')
      setGoal(authenticated.person.goal ?? 'seguir_prescricao')
      setRestrictions(authenticated.person.restrictions ?? [])
      if (authenticated.person.onboarding_completed && authenticated.person.name) { applyPerson(authenticated.person, authenticated.access_token); setStep('app') }
      else setStep('onboarding')
    } catch (e) { setError(e instanceof Error ? e.message : 'Código inválido.') }
    finally { setBusy(false) }
  }

  async function finishOnboarding() {
    if (!session) {
      setError('Sua sessão expirou. Entre novamente para continuar.')
      return
    }
    if (!name.trim()) {
      setError('Informe seu nome para continuar.')
      return
    }
    if (!unitId) {
      setError('Selecione sua empresa / unidade para continuar.')
      return
    }

    setBusy(true); setError('')
    try {
      await saveOnboarding({ token: session.access_token, name: name.trim(), unitId, sector, goal, restrictions })
      const updated = await getMe(session.access_token)
      applyPerson(updated, session.access_token)
      setSession({ ...session, person: updated })
      setStep('app')
    } catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível concluir o cadastro.') }
    finally { setBusy(false) }
  }

  async function signOut() {
    const token = session?.access_token
    try { if (token) await logout(token) } catch {}
    await clearStoredSession(); configureEmployeeAccessToken(null); setSession(null); setPerson(null); setCode(''); setStep('email')
  }

  function handlePersonChange(updated: AuthPerson) {
    setPerson(updated)
    if (session) setSession({ ...session, person: updated })
    if (updated.name) configureEmployeeContext({ id: updated.id, name: updated.name, unitId: updated.unit_id })
  }

  function toggleRestriction(value: string) {
    setRestrictions((current) => current.includes(value) ? current.filter((item) => item !== value) : [...current, value])
  }

  if (step === 'restoring') return <SafeAreaView style={styles.loading}><ActivityIndicator color={colors.red}/><Text style={styles.loadingText}>Abrindo sua conta…</Text></SafeAreaView>
  if (step === 'app' && session && person) return <AuthenticatedApp token={session.access_token} person={person} options={options} onPersonChange={handlePersonChange} onLogout={signOut}/>

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.brandMark}><View style={styles.brandDot}/><Text style={styles.brand}>Apetit</Text></View>
      <Text style={styles.tagline}>ALIMENTA O QUE TE FAZ BEM</Text>

      {step === 'email' && <>
        <Text style={styles.title}>Sua alimentação no trabalho, do seu jeito.</Text>
        <Text style={styles.subtitle}>Entre com seu e-mail para acessar cardápio, recomendações e seu progresso.</Text>
        <Text style={styles.label}>Seu e-mail</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={(value) => { setEmail(value); if (error) setError('') }}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="go"
          onSubmitEditing={sendCode}
          placeholder="voce@gmail.com"
          placeholderTextColor={colors.muted2}
        />
        <Pressable style={[styles.primary, busy && styles.primaryDisabled]} onPress={sendCode} disabled={busy}>
          <Text style={styles.primaryText}>{busy ? 'Enviando…' : 'Receber código de acesso'}</Text>
        </Pressable>
        <View style={styles.note}><Text style={styles.noteTitle}>Acesso simples e seguro</Text><Text style={styles.noteText}>Você recebe um código temporário por e-mail. Não precisa criar uma senha fixa.</Text></View>
      </>}

      {step === 'code' && <>
        <Pressable onPress={() => { setError(''); setStep('email') }}><Text style={styles.back}>‹ Voltar</Text></Pressable>
        <Text style={styles.title}>Digite o código</Text>
        <Text style={styles.subtitle}>{demoCode ? `Modo apresentação ativo para ${email}.` : `Enviamos um código temporário para ${email}.`}</Text>
        {!!demoCode && <View style={styles.demoCode}><Text style={styles.demoCodeLabel}>MODO APRESENTAÇÃO · CÓDIGO DE ACESSO</Text><Text style={styles.demoCodeValue}>{demoCode}</Text><Text style={styles.demoCodeHint}>Na versão final, este código chegará por e-mail.</Text></View>}
        <TextInput style={[styles.input, styles.codeInput]} value={code} onChangeText={(value) => { setCode(value); if (error) setError('') }} keyboardType="number-pad" maxLength={6} placeholder="000000" placeholderTextColor={colors.muted2}/>
        <Pressable style={[styles.primary, busy && styles.primaryDisabled]} onPress={verify} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Validando…' : 'Entrar'}</Text></Pressable>
      </>}

      {step === 'onboarding' && <>
        <Text style={styles.eyebrow}>PRIMEIRO ACESSO</Text>
        <Text style={styles.title}>Vamos configurar seu perfil.</Text>
        <Text style={styles.subtitle}>Esses dados ajudam a mostrar o cardápio certo e respeitar suas preferências e restrições.</Text>
        <Text style={styles.label}>Como podemos te chamar?</Text><TextInput style={styles.input} value={name} onChangeText={(value) => { setName(value); if (error) setError('') }} placeholder="Seu nome" placeholderTextColor={colors.muted2}/>
        <Text style={styles.label}>Empresa / unidade</Text>
        <View style={styles.choiceList}>{options?.units.map((item) => <Pressable key={item.unit_id} style={[styles.choice, unitId === item.unit_id && styles.choiceActive]} onPress={() => { setUnitId(item.unit_id); if (error) setError('') }}><View style={{flex:1}}><Text style={styles.choiceTitle}>{item.company_name}</Text><Text style={styles.choiceText}>{item.unit_name}</Text></View><Text style={[styles.choiceCheck,unitId===item.unit_id&&styles.choiceCheckActive]}>{unitId===item.unit_id?'✓':'○'}</Text></Pressable>)}</View>
        <Text style={styles.label}>Setor</Text><TextInput style={styles.input} value={sector} onChangeText={setSector} placeholder="Ex.: Administrativo" placeholderTextColor={colors.muted2}/>
        <Text style={styles.label}>Seu objetivo</Text>
        <View style={styles.choiceList}>{[['seguir_prescricao','Seguir minha prescrição'],['alimentacao_equilibrada','Manter o equilíbrio'],['melhorar_habitos','Melhorar meus hábitos']].map(([value,label])=><Pressable key={value} style={[styles.choice,goal===value&&styles.choiceActive]} onPress={()=>setGoal(value)}><Text style={styles.choiceTitle}>{label}</Text><Text style={[styles.choiceCheck,goal===value&&styles.choiceCheckActive]}>{goal===value?'✓':'○'}</Text></Pressable>)}</View>
        <Text style={styles.label}>Restrições ou alergias</Text>
        <View style={styles.tags}>{['gluten','lactose','amendoim','castanhas','ovo','soja'].map(item=><Pressable key={item} style={[styles.tag,restrictions.includes(item)&&styles.tagActive]} onPress={()=>toggleRestriction(item)}><Text style={[styles.tagText,restrictions.includes(item)&&styles.tagTextActive]}>{restrictions.includes(item)?'⚠ ':''}{item}</Text></Pressable>)}</View>
        <View style={styles.privacy}><Text style={styles.noteTitle}>🔒 Privacidade</Text><Text style={styles.noteText}>Restrições, prescrições e histórico alimentar são privados. A empresa recebe apenas dados agregados.</Text></View>
        <Pressable style={[styles.primary, busy && styles.primaryDisabled]} onPress={finishOnboarding} disabled={busy}><Text style={styles.primaryText}>{busy ? 'Salvando…' : 'Concluir e entrar no app'}</Text></Pressable>
      </>}

      {!!error && <View style={styles.error}><Text style={styles.errorText}>{error}</Text></View>}
      {busy && step === 'onboarding' && <ActivityIndicator style={{marginTop:18}} color={colors.red}/>} 
    </ScrollView>
  </SafeAreaView>
}

const styles = StyleSheet.create({
  loading:{flex:1,backgroundColor:colors.bg,alignItems:'center',justifyContent:'center'},
  loadingText:{fontSize:11,color:colors.muted,marginTop:12},
  safe:{flex:1,backgroundColor:colors.bg},
  content:{paddingHorizontal:24,paddingTop:34,paddingBottom:48},
  brandMark:{flexDirection:'row',alignItems:'center',gap:8},
  brandDot:{width:12,height:12,borderRadius:3,backgroundColor:colors.red,transform:[{rotate:'45deg'}]},
  brand:{fontSize:23,fontWeight:'900',color:colors.text},
  tagline:{fontSize:8,fontWeight:'900',letterSpacing:2,color:colors.red,marginTop:5,marginBottom:28},
  eyebrow:{fontSize:9,letterSpacing:1.8,fontWeight:'900',color:colors.red},
  title:{fontSize:31,lineHeight:35,fontWeight:'900',color:colors.text,marginTop:8},
  subtitle:{fontSize:13,lineHeight:19,color:colors.muted,marginTop:10,marginBottom:18},
  label:{fontSize:11,fontWeight:'900',color:colors.text,marginTop:12,marginBottom:7},
  input:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,paddingHorizontal:15,minHeight:50,fontSize:14,color:colors.text},
  codeInput:{fontSize:27,letterSpacing:8,textAlign:'center',fontWeight:'900'},
  primary:{backgroundColor:colors.yellow,minHeight:52,borderRadius:radius.md,alignItems:'center',justifyContent:'center',marginTop:14,paddingHorizontal:16},
  primaryDisabled:{opacity:0.72},
  primaryText:{fontWeight:'900',color:'#101010',fontSize:13},
  note:{backgroundColor:colors.surface,borderRadius:radius.md,padding:14,marginTop:14,borderWidth:1,borderColor:colors.border},
  privacy:{backgroundColor:colors.surface,borderRadius:radius.md,padding:14,marginTop:18,borderWidth:1,borderColor:colors.border},
  noteTitle:{fontSize:11,fontWeight:'900',color:colors.text},
  noteText:{fontSize:10,lineHeight:16,color:colors.muted,marginTop:4},
  back:{fontSize:13,fontWeight:'800',color:colors.muted,marginBottom:10},
  demoCode:{backgroundColor:colors.surface,borderRadius:radius.lg,padding:18,alignItems:'center',marginBottom:16,borderWidth:1,borderColor:colors.border},
  demoCodeLabel:{fontSize:9,letterSpacing:1.4,fontWeight:'900',color:colors.muted,textAlign:'center'},
  demoCodeValue:{fontSize:32,letterSpacing:8,fontWeight:'900',color:colors.yellow,marginTop:5},
  demoCodeHint:{fontSize:10,lineHeight:15,color:colors.muted,marginTop:7,textAlign:'center'},
  choiceList:{gap:8},
  choice:{backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,padding:13,minHeight:58,flexDirection:'row',alignItems:'center'},
  choiceActive:{borderColor:colors.red,backgroundColor:'#1A1115'},
  choiceTitle:{fontSize:12,fontWeight:'900',color:colors.text,flex:1},
  choiceText:{fontSize:10,color:colors.muted,marginTop:2},
  choiceCheck:{fontSize:16,color:colors.muted2},
  choiceCheckActive:{color:colors.red},
  tags:{flexDirection:'row',flexWrap:'wrap',gap:8},
  tag:{paddingHorizontal:12,paddingVertical:9,borderRadius:radius.pill,backgroundColor:colors.surface,borderWidth:1,borderColor:colors.border},
  tagActive:{backgroundColor:colors.dangerSoft,borderColor:colors.danger},
  tagText:{fontSize:10,color:colors.muted,textTransform:'capitalize'},
  tagTextActive:{color:'#FF9AA6'},
  error:{backgroundColor:colors.dangerSoft,padding:13,borderRadius:radius.md,marginTop:14,borderWidth:1,borderColor:'#6D2630'},
  errorText:{color:'#FF9AA6',fontSize:11,lineHeight:16}
})