# Guida Configurazione Zapier - Up to Ten Social Media Manager

## ✅ Stato Attuale
- Webhook Zapier configurato e funzionante
- Dashboard HTML pronta per l'invio dei post
- Test di connessione completato con successo

## 📋 Prossimi Passi in Zapier

### 1. Accedi al tuo Zapier Account
Vai su [zapier.com](https://zapier.com) e accedi al tuo account.

### 2. Configura le Azioni per Ogni Piattaforma

Il tuo Zap dovrebbe avere questa struttura:

```
Trigger: Webhooks by Zapier (✅ Già configurato)
   ↓
Action 1: Facebook Pages - Create Page Post
   ↓
Action 2: Twitter - Create Tweet
   ↓
Action 3: LinkedIn - Create Share Update
   ↓
Action 4: Instagram (via Buffer o Later)
```

### 3. Configurazione Facebook
1. Clicca **"+"** per aggiungere un'azione
2. Cerca **"Facebook Pages"**
3. Scegli **"Create Page Post"**
4. Connetti il tuo account Facebook
5. Seleziona la pagina: **Up to Ten**
6. Mappa i campi:
   - Message: `{{message}}` (dal webhook)
   - Link URL: lascia vuoto per ora
   - Photo URL: `{{imageUrl}}` (se presente)

### 4. Configurazione Twitter
1. Aggiungi nuova azione **"+"**
2. Cerca **"Twitter"**
3. Scegli **"Create Tweet"**
4. Connetti il tuo account Twitter
5. Mappa i campi:
   - Message: `{{message}}`
   - Image URL: `{{imageUrl}}`

### 5. Configurazione LinkedIn
1. Aggiungi nuova azione **"+"**
2. Cerca **"LinkedIn"**
3. Scegli **"Create Share Update"**
4. Connetti il tuo account LinkedIn
5. Mappa i campi:
   - Comment: `{{message}}`
   - Content URL: puoi mettere il tuo sito web
   - Content Title: "Up to Ten - Ripetizioni Milano"

### 6. Configurazione Instagram (tramite Buffer)
Instagram non ha API diretta in Zapier, quindi usa Buffer:

1. Crea un account [Buffer](https://buffer.com) se non l'hai
2. Connetti Instagram a Buffer
3. In Zapier, aggiungi azione **"Buffer"**
4. Scegli **"Add to Queue"**
5. Mappa i campi:
   - Text: `{{message}}`
   - Photo URL: `{{imageUrl}}`
   - Profile IDs: seleziona Instagram

## 🔧 Mappatura Dati Webhook

I dati che arrivano dal tuo dashboard hanno questa struttura:
```json
{
  "message": "Il testo del post",
  "platforms": ["facebook", "instagram", "twitter", "linkedin"],
  "hashtags": ["#UpToTen", "#Milano"],
  "imageUrl": "URL dell'immagine (opzionale)",
  "metadata": {
    "theme": "motivational",
    "generatedBy": "AI Generator",
    "timestamp": "2024-01-24T10:00:00Z",
    "brand": "Up to Ten - Ripetizioni Milano"
  }
}
```

## 🎯 Filtri Condizionali (Opzionale)

Per pubblicare solo su piattaforme specifiche:

1. Dopo ogni azione, aggiungi un **"Filter"**
2. Configura: **Only continue if** `platforms` **contains** `facebook` (o la piattaforma specifica)

## 🚀 Attivazione

1. Testa ogni step cliccando **"Test & Review"**
2. Quando tutto funziona, clicca **"Publish Zap"**
3. Assicurati che sia **ON**

## 📊 Monitoraggio

- Controlla **Task History** per vedere i post pubblicati
- Abilita le notifiche email per errori
- Zapier Free Plan: 100 task/mese

## 🆘 Troubleshooting

**Errore Facebook**: Assicurati di aver dato i permessi di pubblicazione
**Errore Twitter**: Verifica i limiti di caratteri (280)
**Instagram non funziona**: Deve passare attraverso Buffer o Later
**LinkedIn non pubblica**: Controlla che sia un profilo aziendale

## 💡 Suggerimenti

1. **Schedulazione**: Usa Zapier Schedule per pubblicare a orari specifici
2. **Immagini**: Considera di usare Cloudinary per hosting immagini
3. **Analytics**: Aggiungi Google Sheets per tracciare tutti i post

---

Una volta configurato tutto, la tua dashboard invierà automaticamente i post a tutte le piattaforme! 🎉