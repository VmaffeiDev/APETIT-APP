import { useState } from 'react'
import * as DocumentPicker from 'expo-document-picker'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { confirmPrescription, Portion, PrescriptionPreview, uploadPrescription } from './api'
import { colors, radius } from './theme'

const toText = (value: number | null) => value == null ? '' : String(value)
const toNumber = (value: string) => {
  const normalized = value.trim().replace(',', '.')
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null
}

export default function PrescriptionReview({ personId, onClose }: { personId: string; onClose: () => void }) {
  const [preview, setPreview] = useState<PrescriptionPreview | null>(null)
  const [kcal, setKcal] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [portions, setPortions] = useState<Portion[]>([])
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [confirmed, setConfirmed] = useState(false)

  function hydrate(next: PrescriptionPreview) {
    setPreview(next)
    setKcal(toText(next.meal?.target.kcal ?? null))
    setProtein(toText(next.meal?.target.protein_g ?? null))
    setCarbs(toText(next.meal?.target.carbs_g ?? null))
    setFat(toText(next.meal?.target.fat_g ?? null))
    setPortions(next.meal?.portions ?? [])
    setConfirmed(false)
  }

  async function chooseDocument() {
    setBusy(true); setMessage('')
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf','text/plain','image/jpeg','image/png','image/webp'], copyToCacheDirectory: true })
      if (result.canceled) return
      const file = result.assets[0]
      const next = await uploadPrescription({ personId, uri: file.uri, name: file.name, mimeType: file.mimeType })
      hydrate(next)
      if (!next.meal) setMessage(next.message)
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível ler a prescrição.') }
    finally { setBusy(false) }
  }

  function updatePortion(index: number, patch: Partial<Portion>) { setPortions((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item)) }
  function addPortion() { setPortions((current) => [...current, { category: '', quantity: null, unit: 'g', notes: null }]) }
  function removePortion(index: number) { setPortions((current) => current.filter((_, i) => i !== index)) }

  async function confirmEdited() {
    if (!preview?.meal) return
    setBusy(true); setMessage('')
    try {
      const edited: PrescriptionPreview = {
        ...preview,
        meal: {
          ...preview.meal,
          target: { kcal: toNumber(kcal), protein_g: toNumber(protein), carbs_g: toNumber(carbs), fat_g: toNumber(fat) },
          portions: portions.filter((item) => item.category.trim()).map((item) => ({ ...item, category: item.category.trim(), quantity: item.quantity == null ? null : Number(item.quantity), unit: item.unit?.trim() || null, notes: item.notes?.trim() || null })),
        },
      }
      await confirmPrescription(edited)
      setPreview(edited); setConfirmed(true)
      setMessage('Prescrição confirmada. O app já pode usar esses dados nas recomendações.')
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Não foi possível confirmar a prescrição.') }
    finally { setBusy(false) }
  }

  const ocrSource = preview?.extraction_status === 'ocr'

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <View style={styles.topRow}><Pressable style={styles.backButton} onPress={onClose}><Text style={styles.back}>‹</Text></Pressable><Text style={styles.topTitle}>Prescrição</Text><View style={styles.topGhost}/></View>
      <Text style={styles.eyebrow}>CONTROLE NUTRICIONAL</Text>
      <Text style={styles.title}>Minha prescrição</Text>
      <Text style={styles.subtitle}>Envie PDF ou imagem. O app lê o documento, mas você sempre revisa e confirma os dados antes de usá-los.</Text>

      {!preview && <>
        <View style={styles.uploadBox}><View style={styles.uploadIcon}><Text style={styles.uploadIconText}>⇧</Text></View><Text style={styles.uploadTitle}>Enviar prescrição</Text><Text style={styles.uploadText}>PDF, JPG, PNG, WEBP ou TXT</Text><Pressable style={styles.primary} onPress={chooseDocument}><Text style={styles.primaryText}>Selecionar arquivo</Text></Pressable></View>
        <View style={styles.safeCard}><Text style={styles.safeTitle}>🔒 Nada é ativado automaticamente</Text><Text style={styles.safeText}>OCR pode interpretar números ou porções de forma incorreta. Revise o conteúdo antes de confirmar.</Text></View>
      </>}

      {preview && !preview.meal && <><View style={styles.warning}><Text style={styles.warningTitle}>Ainda não foi possível extrair os dados</Text><Text style={styles.warningText}>{preview.message}</Text></View><Pressable style={styles.primary} onPress={chooseDocument}><Text style={styles.primaryText}>Tentar outro arquivo</Text></Pressable></>}

      {preview?.meal && <>
        <View style={ocrSource ? styles.ocrBadge : styles.textBadge}><Text style={ocrSource ? styles.ocrBadgeText : styles.textBadgeText}>{ocrSource ? 'LIDO COM OCR · REVISÃO OBRIGATÓRIA' : 'TEXTO EXTRAÍDO · CONFIRA ANTES DE SALVAR'}</Text></View>
        <Text style={styles.fileName}>{preview.file_name}</Text>
        <Text style={styles.section}>Metas do almoço</Text>
        <View style={styles.grid}><Field label="Energia" value={kcal} onChange={setKcal} suffix="kcal"/><Field label="Proteína" value={protein} onChange={setProtein} suffix="g"/><Field label="Carboidratos" value={carbs} onChange={setCarbs} suffix="g"/><Field label="Gorduras" value={fat} onChange={setFat} suffix="g"/></View>
        <View style={styles.sectionRow}><Text style={styles.section}>Porções</Text><Pressable onPress={addPortion}><Text style={styles.add}>+ adicionar</Text></Pressable></View>
        {portions.length === 0 && <Text style={styles.empty}>Nenhuma porção foi identificada. Você pode adicionar manualmente.</Text>}
        {portions.map((portion,index)=><View key={index} style={styles.portionCard}>
          <Text style={styles.smallLabel}>Alimento / categoria</Text><TextInput style={styles.input} value={portion.category} onChangeText={(value)=>updatePortion(index,{category:value})} placeholder="Ex.: frango" placeholderTextColor={colors.muted2}/>
          <View style={styles.row}><View style={styles.flex}><Text style={styles.smallLabel}>Quantidade</Text><TextInput style={styles.input} keyboardType="decimal-pad" value={portion.quantity==null?'':String(portion.quantity)} onChangeText={(value)=>updatePortion(index,{quantity:toNumber(value)})} placeholder="120" placeholderTextColor={colors.muted2}/></View><View style={styles.flex}><Text style={styles.smallLabel}>Unidade</Text><TextInput style={styles.input} value={portion.unit??''} onChangeText={(value)=>updatePortion(index,{unit:value})} placeholder="g" placeholderTextColor={colors.muted2}/></View></View>
          <Text style={styles.smallLabel}>Observação</Text><TextInput style={styles.input} value={portion.notes??''} onChangeText={(value)=>updatePortion(index,{notes:value})} placeholder="Opcional" placeholderTextColor={colors.muted2}/>
          <Pressable onPress={()=>removePortion(index)}><Text style={styles.remove}>Remover porção</Text></Pressable>
        </View>)}
        <View style={styles.safeCard}><Text style={styles.safeTitle}>✓ Confirme somente após revisar</Text><Text style={styles.safeText}>Os valores acima serão usados para comparar o cardápio do dia com a orientação do profissional.</Text></View>
        <Pressable style={[styles.primary,confirmed&&styles.disabled]} disabled={busy||confirmed} onPress={confirmEdited}><Text style={styles.primaryText}>{confirmed?'Prescrição confirmada':'Confirmar dados revisados'}</Text></Pressable>
        <Pressable style={styles.secondary} onPress={chooseDocument}><Text style={styles.secondaryText}>Enviar outro documento</Text></Pressable>
      </>}
      {!!message&&<View style={styles.message}><Text style={styles.messageText}>{message}</Text></View>}
      {busy&&<ActivityIndicator style={{marginTop:18}} color={colors.red}/>} 
    </ScrollView>
  </SafeAreaView>
}

function Field({label,value,onChange,suffix}:{label:string;value:string;onChange:(value:string)=>void;suffix:string}) { return <View style={styles.field}><Text style={styles.smallLabel}>{label}</Text><View style={styles.valueWrap}><TextInput style={styles.valueInput} keyboardType="decimal-pad" value={value} onChangeText={onChange} placeholder="—" placeholderTextColor={colors.muted2}/><Text style={styles.suffix}>{suffix}</Text></View></View> }

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:colors.bg},content:{padding:18,paddingBottom:60},topRow:{height:52,flexDirection:'row',alignItems:'center',justifyContent:'space-between'},backButton:{width:36,height:36,borderRadius:18,borderWidth:1,borderColor:colors.border,alignItems:'center',justifyContent:'center'},back:{fontSize:25,color:colors.text,marginTop:-2},topTitle:{fontSize:17,fontWeight:'900',color:colors.text},topGhost:{width:36},eyebrow:{fontSize:9,letterSpacing:1.6,fontWeight:'900',color:colors.red,marginTop:12},title:{fontSize:29,fontWeight:'900',color:colors.text,marginTop:6},subtitle:{fontSize:12,lineHeight:18,color:colors.muted,marginTop:8,marginBottom:18},uploadBox:{backgroundColor:colors.surface,borderWidth:1,borderStyle:'dashed',borderColor:colors.border,borderRadius:radius.lg,padding:18,alignItems:'center'},uploadIcon:{width:54,height:54,borderRadius:16,backgroundColor:colors.surfaceAlt,alignItems:'center',justifyContent:'center'},uploadIconText:{fontSize:26,color:colors.red},uploadTitle:{fontSize:17,fontWeight:'900',color:colors.text,marginTop:12},uploadText:{fontSize:10,color:colors.muted,marginTop:4},primary:{backgroundColor:colors.yellow,minHeight:52,borderRadius:radius.md,alignItems:'center',justifyContent:'center',marginTop:16,paddingHorizontal:14,width:'100%'},primaryText:{fontSize:12,fontWeight:'900',color:'#101010'},secondary:{minHeight:49,borderWidth:1,borderColor:colors.border,borderRadius:radius.md,alignItems:'center',justifyContent:'center',marginTop:9},secondaryText:{fontSize:11,fontWeight:'900',color:colors.text},disabled:{opacity:.55},safeCard:{backgroundColor:colors.surface,borderRadius:radius.md,padding:14,marginTop:14,borderWidth:1,borderColor:colors.border},safeTitle:{fontSize:11,fontWeight:'900',color:colors.text},safeText:{fontSize:10,lineHeight:16,color:colors.muted,marginTop:4},warning:{backgroundColor:colors.yellowSoft,borderRadius:radius.md,padding:14,borderWidth:1,borderColor:'#665813'},warningTitle:{fontSize:12,fontWeight:'900',color:colors.yellow},warningText:{fontSize:10,lineHeight:16,color:'#D9CCA1',marginTop:4},ocrBadge:{alignSelf:'flex-start',backgroundColor:colors.red,borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:7},ocrBadgeText:{fontSize:8,fontWeight:'900',letterSpacing:.4,color:colors.white},textBadge:{alignSelf:'flex-start',backgroundColor:colors.surfaceAlt,borderRadius:radius.pill,paddingHorizontal:10,paddingVertical:7,borderWidth:1,borderColor:colors.border},textBadgeText:{fontSize:8,fontWeight:'900',letterSpacing:.3,color:colors.muted},fileName:{fontSize:10,color:colors.muted,marginTop:9},section:{fontSize:15,fontWeight:'900',color:colors.text,marginTop:21,marginBottom:9},sectionRow:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between'},add:{fontSize:10,fontWeight:'900',color:colors.yellow},grid:{flexDirection:'row',flexWrap:'wrap',gap:9},field:{width:'48%',backgroundColor:colors.surface,borderRadius:radius.md,padding:13,borderWidth:1,borderColor:colors.border},smallLabel:{fontSize:9,fontWeight:'800',color:colors.muted,marginBottom:5},valueWrap:{flexDirection:'row',alignItems:'center'},valueInput:{flex:1,fontSize:19,fontWeight:'900',color:colors.text,padding:0},suffix:{fontSize:10,color:colors.muted},portionCard:{backgroundColor:colors.surface,borderRadius:radius.md,padding:13,borderWidth:1,borderColor:colors.border,marginBottom:9},input:{backgroundColor:colors.surfaceAlt,borderRadius:11,paddingHorizontal:11,minHeight:43,fontSize:12,color:colors.text,marginBottom:9,borderWidth:1,borderColor:colors.borderSoft},row:{flexDirection:'row',gap:9},flex:{flex:1},remove:{fontSize:10,fontWeight:'800',color:colors.danger,marginTop:2},empty:{fontSize:11,lineHeight:17,color:colors.muted,backgroundColor:colors.surface,borderRadius:radius.md,padding:13,borderWidth:1,borderColor:colors.border},message:{backgroundColor:colors.greenSoft,borderRadius:radius.md,padding:12,marginTop:13,borderWidth:1,borderColor:'#205E42'},messageText:{fontSize:10,lineHeight:16,color:colors.green}
})