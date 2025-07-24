# Up to Ten Social Media Manager 🚀

Sistema di gestione automatica dei social media per Up to Ten - Centro di eccellenza per ripetizioni a Milano.

## 🌟 Caratteristiche

- **Generazione Contenuti AI**: Crea post automaticamente usando GPT-4
- **Multi-piattaforma**: Facebook, Instagram, Twitter, LinkedIn
- **Schedulazione Automatica**: Pubblica secondo orari configurabili
- **Dashboard Intuitiva**: Interfaccia web semplice e potente
- **Integrazione Zapier**: Distribuzione automatica su tutti i social

## 🚀 Accesso Rapido

Una volta deployato su GitHub Pages:
- **Dashboard**: https://filippofiz.github.io/uptoten_socialmediamanager/dashboard-zapier.html
- **Scheduler**: https://filippofiz.github.io/uptoten_socialmediamanager/auto-scheduler.html

## 🔧 Configurazione

### 1. Chiave API OpenAI
Per far funzionare la generazione AI, devi configurare la tua chiave OpenAI:

1. Apri il file `dashboard-zapier.html` o `auto-scheduler.html`
2. Modifica questa riga con la tua chiave:
   ```javascript
   const OPENAI_API_KEY = 'LA_TUA_CHIAVE_QUI';
   ```

### 2. Zapier Webhook
Il webhook Zapier è già configurato nei file. Se vuoi usare il tuo:
1. Crea un nuovo Zap in Zapier
2. Usa "Webhooks by Zapier" come trigger
3. Copia il webhook URL
4. Sostituisci nei file HTML

## 📱 Funzionalità

### Dashboard Principale
- Generazione contenuti AI per tema
- Post manuali immediati
- Template rapidi
- Statistiche e post recenti

### Scheduler Automatico
- Configurazione orari e frequenza
- Mix di contenuti personalizzabile
- Giorni della settimana selezionabili
- Log attività in tempo reale

## 🛠️ Tecnologie

- Frontend: HTML5, TailwindCSS, JavaScript
- AI: OpenAI GPT-4 e DALL-E
- Backend: TypeScript, Node.js (opzionale)
- Database: Supabase (per funzionalità avanzate)
- Distribuzione: Zapier

## 📦 Struttura Progetto

```
/
├── dashboard-zapier.html    # Dashboard principale
├── auto-scheduler.html      # Sistema di schedulazione
├── index.html              # Landing page
├── backend/                # Server Node.js (opzionale)
│   ├── src/
│   │   ├── services/      # Servizi AI e social
│   │   └── types/         # TypeScript types
│   └── package.json
└── zapier-setup-guide.md   # Guida configurazione Zapier
```

## 🚀 Deploy

1. Fork questo repository
2. Vai in Settings > Pages
3. Seleziona "Deploy from a branch"
4. Scegli branch `main` e cartella `/ (root)`
5. Salva e attendi il deploy

## 🔐 Sicurezza

**IMPORTANTE**: Non committare mai chiavi API nel repository!
- Usa variabili d'ambiente per il backend
- Per il frontend, considera un proxy server
- Le chiavi nel file `.env` sono solo esempi

## 📝 Licenza

Proprietà di Up to Ten - Tutti i diritti riservati

## 🆘 Supporto

Per assistenza o domande sul sistema, contatta il team tecnico Up to Ten.

---

Made with ❤️ for Up to Ten - Excellence in Education