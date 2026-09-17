import { useState } from 'react'
import * as DocumentPicker from 'expo-document-picker'
import { ActivityIndicator, Pressable, SafeAreaView, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native'

import { confirmPrescription, Portion, PrescriptionPreview, uploadPrescription } from './api'

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
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'image/jpeg', 'image/png', 'image/webp'],
        copyToCacheDirectory: true,
      })
      if (result.canceled) return
      const file = result.assets[0]
      const next = await uploadPrescription({
        personId,
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
      })
      hydrate(next)
      if (!next.meal) setMessage(next.message)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível ler a prescrição.')
    } finally { setBusy(false) }
  }

  function updatePortion(index: number, patch: Partial<Portion>) {
    setPortions((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item))
  }

  function addPortion() {
    setPortions((current) => [...current, { category: '', quantity: null, unit: 'g', notes: null }])
  }

  function removePortion(index: number) {
    setPortions((current) => current.filter((_, i) => i !== index))
  }

  async function confirmEdited() {
    if (!preview?.meal) return
    setBusy(true); setMessage('')
    try {
      const edited: PrescriptionPreview = {
        ...preview,
        meal: {
          ...preview.meal,
          target: {
            kcal: toNumber(kcal),
            protein_g: toNumber(protein),
            carbs_g: toNumber(carbs),
            fat_g: toNumber(fat),
          },
          portions: portions
            .filter((item) => item.category.trim())
            .map((item) => ({
              ...item,
              category: item.category.trim(),
              quantity: item.quantity == null ? null : Number(item.quantity),
              unit: item.unit?.trim() || null,
              notes: item.notes?.trim() || null,
            })),
        },
      }
      await confirmPrescription(edited)
      setPreview(edited)
      setConfirmed(true)
      setMessage('Prescrição confirmada. A partir de agora o app pode usar esses dados nas recomendações.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível confirmar a prescrição.')
    } finally { setBusy(false) }
  }

  const ocrSource = preview?.extraction_status === 'ocr'

  return <SafeAreaView style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onClose}><Text style={styles.back}>‹ Voltar</Text></Pressable>
      <Text style={styles.eyebrow}>CONTROLE NUTRICIONAL</Text>
      <Text style={styles.title}>Minha prescrição</Text>
      <Text style={styles.subtitle}>Envie PDF ou imagem. O app lê o documento, mas você sempre confere e corrige os dados antes de confirmar.</Text>

      {!preview && <>
        <View style={styles.uploadBox}>
          <Text style={styles.uploadTitle}>Enviar prescrição</Text>
          <Text style={styles.uploadText}>PDF, JPG, PNG, WEBP ou TXT</Text>
          <Pressable style={styles.primary} onPress={chooseDocument}><Text style={styles.primaryText}>Selecionar arquivo</Text></Pressable>
        </View>
        <View style={styles.safeCard}><Text style={styles.safeTitle}>Nada é ativado automaticamente</Text><Text style={styles.safeText}>OCR pode interpretar números ou porções de forma incorreta. Revise o conteúdo antes de confirmar.</Text></View>
      </>}

      {preview && !preview.meal && <>
        <View style={styles.warning}><Text style={styles.warningTitle}>Ainda não foi possível extrair os dados</Text><Text style={styles.warningText}>{preview.message}</Text></View>
        <Pressable style={styles.primary} onPress={chooseDocument}><Text style={styles.primaryText}>Tentar outro arquivo</Text></Pressable>
      </>}

      {preview?.meal && <>
        <View style={ocrSource ? styles.ocrBadge : styles.textBadge}><Text style={ocrSource ? styles.ocrBadgeText : styles.textBadgeText}>{ocrSource ? 'LIDO COM OCR · REVISÃO OBRIGATÓRIA' : 'TEXTO EXTRAÍDO · CONFIRA ANTES DE SALVAR'}</Text></View>
        <Text style={styles.fileName}>{preview.file_name}</Text>

        <Text style={styles.section}>Metas do almoço</Text>
        <View style={styles.grid}>
          <Field label="Energia" value={kcal} onChange={setKcal} suffix="kcal" />
          <Field label="Proteína" value={protein} onChange={setProtein} suffix="g" />
          <Field label="Carboidratos" value={carbs} onChange={setCarbs} suffix="g" />
          <Field label="Gorduras" value={fat} onChange={setFat} suffix="g" />
        </View>

        <View style={styles.sectionRow}><Text style={styles.section}>Porções</Text><Pressable onPress={addPortion}><Text style={styles.add}>+ adicionar</Text></Pressable></View>
        {portions.length === 0 && <Text style={styles.empty}>Nenhuma porção foi identificada. Você pode adicionar manualmente.</Text>}
        {portions.map((portion, index) => <View key={index} style={styles.portionCard}>
          <Text style={styles.smallLabel}>Alimento / categoria</Text>
          <TextInput style={styles.input} value={portion.category} onChangeText={(value) => updatePortion(index, { category: value })} placeholder="Ex.: frango" />
          <View style={styles.row}>
            <View style={styles.flex}><Text style={styles.smallLabel}>Quantidade</Text><TextInput style={styles.input} keyboardType="decimal-pad" value={portion.quantity == null ? '' : String(portion.quantity)} onChangeText={(value) => updatePortion(index, { quantity: toNumber(value) })} placeholder="120" /></View>
            <View style={styles.flex}><Text style={styles.smallLabel}>Unidade</Text><TextInput style={styles.input} value={portion.unit ?? ''} onChangeText={(value) => updatePortion(index, { unit: value })} placeholder="g" /></View>
          </View>
          <Text style={styles.smallLabel}>Observação</Text>
          <TextInput style={styles.input} value={portion.notes ?? ''} onChangeText={(value) => updatePortion(index, { notes: value })} placeholder="Opcional" />
          <Pressable onPress={() => removePortion(index)}><Text style={styles.remove}>Remover porção</Text></Pressable>
        </View>)}

        <View style={styles.safeCard}><Text style={styles.safeTitle}>Confirme somente após revisar</Text><Text style={styles.safeText}>Os valores acima serão usados para comparar o cardápio do dia com a orientação do profissional.</Text></View>
        <Pressable style={[styles.primary, confirmed && styles.disabled]} disabled={busy || confirmed} onPress={confirmEdited}><Text style={styles.primaryText}>{confirmed ? 'Prescrição confirmada' : 'Confirmar dados revisados'}</Text></Pressable>
        <Pressable style={styles.secondary} onPress={chooseDocument}><Text style={styles.secondaryText}>Enviar outro documento</Text></Pressable>
      </>}

      {!!message && <View style={styles.message}><Text style={styles.messageText}>{message}</Text></View>}
      {busy && <ActivityIndicator style={{ marginTop: 18 }} color="#171714" />}
    </ScrollView>
  </SafeAreaView>
}

function Field({ label, value, onChange, suffix }: { label: string; value: string; onChange: (value: string) => void; suffix: string }) {
  return <View style={styles.field}><Text style={styles.smallLabel}>{label}</Text><View style={styles.valueWrap}><TextInput style={styles.valueInput} keyboardType="decimal-pad" value={value} onChangeText={onChange} placeholder="—" /><Text style={styles.suffix}>{suffix}</Text></View></View>
}

const styles = StyleSheet.create({
  safe:{flex:1,backgroundColor:'#F5F4F0'},content:{padding:22,paddingBottom:60},back:{fontSize:14,fontWeight:'800',color:'#706A60',marginBottom:22},eyebrow:{fontSize:11,letterSpacing:2,fontWeight:'900',color:'#9A792D'},title:{fontSize:34,fontWeight:'900',color:'#171714',marginTop:8},subtitle:{fontSize:14,lineHeight:21,color:'#777168',marginTop:10,marginBottom:20},uploadBox:{backgroundColor:'#fff',borderWidth:1,borderStyle:'dashed',borderColor:'#CFC6B7',borderRadius:22,padding:20},uploadTitle:{fontSize:19,fontWeight:'900',color:'#171714'},uploadText:{fontSize:12,color:'#817B70',marginTop:5},primary:{backgroundColor:'#D8B248',minHeight:55,borderRadius:18,alignItems:'center',justifyContent:'center',marginTop:18,paddingHorizontal:15},primaryText:{fontSize:14,fontWeight:'900',color:'#171714'},secondary:{minHeight:52,borderWidth:1,borderColor:'#D8D1C5',borderRadius:18,alignItems:'center',justifyContent:'center',marginTop:10},secondaryText:{fontSize:14,fontWeight:'900',color:'#514C44'},disabled:{opacity:.55},safeCard:{backgroundColor:'#EAF3EC',borderRadius:18,padding:16,marginTop:18},safeTitle:{fontSize:13,fontWeight:'900',color:'#314035'},safeText:{fontSize:12,lineHeight:18,color:'#657067',marginTop:5},warning:{backgroundColor:'#FFF1D6',borderRadius:18,padding:16},warningTitle:{fontSize:14,fontWeight:'900',color:'#71501E'},warningText:{fontSize:12,lineHeight:18,color:'#806232',marginTop:5},ocrBadge:{alignSelf:'flex-start',backgroundColor:'#171714',borderRadius:999,paddingHorizontal:11,paddingVertical:8},ocrBadgeText:{fontSize:10,fontWeight:'900',letterSpacing:.5,color:'#D8B248'},textBadge:{alignSelf:'flex-start',backgroundColor:'#E9E5DC',borderRadius:999,paddingHorizontal:11,paddingVertical:8},textBadgeText:{fontSize:10,fontWeight:'900',letterSpacing:.4,color:'#615B52'},fileName:{fontSize:12,color:'#817B70',marginTop:10},section:{fontSize:17,fontWeight:'900',color:'#171714',marginTop:24,marginBottom:10},sectionRow:{flexDirection:'row',alignItems:'baseline',justifyContent:'space-between'},add:{fontSize:12,fontWeight:'900',color:'#9A792D'},grid:{flexDirection:'row',flexWrap:'wrap',gap:10},field:{width:'48%',backgroundColor:'#fff',borderRadius:17,padding:14,borderWidth:1,borderColor:'#E4DED2'},smallLabel:{fontSize:11,fontWeight:'800',color:'#777168',marginBottom:6},valueWrap:{flexDirection:'row',alignItems:'center'},valueInput:{flex:1,fontSize:22,fontWeight:'900',color:'#171714',padding:0},suffix:{fontSize:12,color:'#8A847A'},portionCard:{backgroundColor:'#fff',borderRadius:20,padding:15,borderWidth:1,borderColor:'#E4DED2',marginBottom:10},input:{backgroundColor:'#F8F6F2',borderRadius:13,paddingHorizontal:12,minHeight:46,fontSize:14,color:'#171714',marginBottom:10},row:{flexDirection:'row',gap:10},flex:{flex:1},remove:{fontSize:12,fontWeight:'800',color:'#9B4238',marginTop:2},empty:{fontSize:13,lineHeight:19,color:'#777168',backgroundColor:'#fff',borderRadius:16,padding:14},message:{backgroundColor:'#EEEAE2',borderRadius:15,padding:13,marginTop:14},messageText:{fontSize:12,lineHeight:18,color:'#5D584F'}
})