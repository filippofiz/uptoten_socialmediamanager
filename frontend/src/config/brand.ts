export const BRAND = {
  name: 'Up to Ten',
  tagline: 'Il Tuo Centro per Ripetizioni Scientifiche a Milano',
  description: 'Centro di eccellenza per ripetizioni di Matematica, Fisica, Informatica e materie STEM',
  colors: {
    primary: '#00a666', // Verde Up to Ten
    secondary: '#1c2545', // Blu scuro (28,37,69 in hex)
    accent: '#00a666',
    background: '#ffffff',
    text: '#1c2545',
    textLight: '#6b7280',
    success: '#00a666',
    error: '#ef4444',
    warning: '#f59e0b'
  },
  subjects: [
    'Matematica',
    'Fisica', 
    'Informatica',
    'Scienze',
    'Chimica',
    'Biologia',
    'Statistica',
    'Ingegneria'
  ],
  levels: [
    'Scuole Medie',
    'Liceo',
    'Università'
  ],
  socialMediaThemes: [
    'tips_studio',
    'motivazionale',
    'spiegazioni_semplici',
    'curiosita_scientifiche',
    'successi_studenti',
    'metodo_studio',
    'esempi_pratici',
    'sport_e_scienza'
  ],
  contentTemplates: {
    tips_studio: {
      name: 'Consigli di Studio',
      hashtags: ['#RipetizioniMilano', '#UpToTen', '#StudiaConNoi', '#MatematicaFacile', '#FisicaSemplice'],
      style: 'educativo e incoraggiante'
    },
    motivazionale: {
      name: 'Motivazione Studenti',
      hashtags: ['#CeLaPuoiFare', '#StudiaConPassione', '#UpToTen', '#SuccessoScolastico'],
      style: 'ispirante e positivo'
    },
    spiegazioni_semplici: {
      name: 'Concetti Semplificati',
      hashtags: ['#MatematicaSemplice', '#FisicaFacile', '#UpToTen', '#ImparaConNoi'],
      style: 'chiaro e visuale'
    },
    curiosita_scientifiche: {
      name: 'Curiosità STEM',
      hashtags: ['#Scienza', '#CuriositàSTEM', '#UpToTen', '#ImparaOgniGiorno'],
      style: 'interessante e coinvolgente'
    },
    sport_e_scienza: {
      name: 'Sport e Scienza',
      hashtags: ['#SportEScienza', '#FisicaNelloSport', '#UpToTen', '#STEMeSport'],
      style: 'dinamico e pratico'
    }
  }
};