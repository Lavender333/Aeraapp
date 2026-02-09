
import { StorageService } from './storage';

export type LanguageCode = 'en' | 'es' | 'fr';

const DICTIONARY: Record<LanguageCode, Record<string, string>> = {
  en: {
    // General
    "app.name": "AERA",
    "btn.submit": "Submit",
    "btn.next": "Next Step",
    "btn.back": "Back",
    "btn.cancel": "Cancel",
    "btn.save": "Save Settings",
    "btn.confirm": "Confirm",
    "btn.copy": "Copy",
    "btn.apply": "Apply Now",
    "status.safe": "Safe",
    "status.danger": "In Danger",
    "status.unknown": "Unknown",
    
    // Splash
    "splash.motto": "Mitigate • Communicate • Respond • Recover",
    "splash.desc": "An innovative tool for real-time emergency response and community aid.",
    "splash.enter": "Enter App",
    "splash.disclaimer": "Not a substitute for 911",
    
    // Login
    "login.welcome": "Welcome Back",
    "login.subtitle": "Log in to your AERA account.",
    "login.phone_label": "Mobile Phone",
    "login.btn": "Log In",
    "login.demo_title": "Tap to Login (Demo)",
    "login.no_account": "Don't have an account?",
    "login.create": "Create Account",

    // Dashboard
    "dash.welcome": "Welcome",
    "dash.offline": "Offline Mode Active - Data will sync when signal returns",
    "dash.get_help": "Get Help Now",
    "dash.report_emergency": "Report emergency immediately",
    "dash.request_active": "Request Active",
    "dash.tracking": "Responders tracking location.",
    "dash.resource_depot": "Nearest Resource Depot",
    "dash.alerts": "Alerts Console",
    "dash.gap": "G.A.P. Center",
    "dash.gap.desc": "Grants, Advances & Payments",
    "dash.assess": "Assessments",
    "dash.assess.desc": "Report damage & needs",
    "dash.logistics": "Logistics",
    "dash.logistics.desc": "Retail & Supply Chain",
    "dash.manage_org": "Manage Organization Hub",

    // GAP (Financial Aid)
    "gap.title": "Financial Aid Center (G.A.P.)",
    "gap.subtitle": "Grants • Advances • Payments",
    "gap.funding_avail": "Available Funding",
    "gap.funding_desc": "You are eligible for immediate emergency relief assistance based on your location.",
    "gap.grant.housing": "Emergency Housing Grant",
    "gap.grant.housing_desc": "Support for temporary shelter and housing repairs.",
    "gap.grant.business": "Small Business Relief",
    "gap.grant.business_desc": "Inventory replacement support for local businesses.",
    "gap.status.open": "OPEN",
    "gap.status.pending": "PENDING",
    "gap.no_advances": "No active cash advances.",
    "gap.req_advance": "Request Advance",

    // Logistics
    "logistics.title": "Retail Inventory",
    "logistics.subtitle": "Live Supply Chain Integration",
    "logistics.depot": "Nearest Supply Depot",
    "logistics.retail_avail": "Retail Availability (Live)",

    // Alerts
    "alerts.title": "Alerts & Intel",
    "alerts.search_placeholder": "Scan for news (e.g. 'Storm path updates')...",
    "alerts.official": "Official Broadcasts",
    "alerts.quick_scan": "Quick Situational Scan",
    "alerts.ai_summary": "Live Intelligence Summary",
    "alerts.sources": "Sources & Verification",

    // Org Dashboard
    "org.broadcast": "Broadcast",
    "org.verified": "VERIFIED HUB",
    "org.code": "Community Code",
    "org.tab.members": "Member Status",
    "org.tab.inventory": "Hub Inventory",
    "org.manage_res": "Manage Resources",
    "org.manage_desc": "Update your current stock levels. This data is visible to nearby users searching for aid.",
    "org.req_replenish": "Request Replenishment",
    "org.req_desc": "Low on stock? Request immediate resupply from the central warehouse.",
    "org.create_req": "Create Supply Request",
    "org.submit_req": "Submit Request",

    // Help Form
    "help.title": "Emergency Report",
    "help.safe_q": "Are you safe right now?",
    "help.yes_safe": "Yes, I'm safe",
    "help.no_danger": "No, I'm in danger",
    "help.location": "Last Known Location",
    "help.detecting": "Detecting coordinates...",
    "help.manual": "Enter manually",
    "help.use_gps": "Use GPS",
    "help.stop_share": "Stop Sharing",
    "help.what_need": "What do you need?",
    "help.injured_q": "Is anyone injured?",
    "help.situation": "Describe what is happening",
    "help.evac_q": "Can you leave your location?",
    "help.people_count": "How many people are with you?",
    "help.pets_q": "Are there pets?",
    "help.resources_title": "Resource Check",
    "help.resources_desc": "Do you currently have access to:",
    "help.vuln_title": "Vulnerable Individuals Present",
    "help.medical_cond": "Medical Conditions / Special Needs",
    "help.upload": "Upload Photos / Video (Optional)",
    "help.review": "Review & Submit",
    "help.consent": "I consent to share my information with AERA and emergency services to receive help.",
    "help.submit_btn": "Submit Emergency Request",
    "help.success_title": "Request Sent",
    "help.success_desc": "Emergency responders have received your request and are tracking your real-time location.",
    "help.text_contact": "Notify Contact via SMS",
    "help.return_dash": "Return to Dashboard",

    // Registration
    "reg.title": "Account Setup",
    "reg.skip": "I have an emergency",
    "reg.skip_desc": "Skip setup and request help now",
    "reg.personal": "Who are you?",
    "reg.personal_desc": "Basic contact info for emergency responders.",
    "reg.vital": "Vital Intake",
    "reg.vital_desc": "Filling this now saves critical time during an emergency.",
    "reg.community": "Community Connect",
    "reg.community_desc": "Link to a trusted institution for specialized aid.",
    "reg.safety": "Safety & Privacy",
    "reg.complete": "Complete Setup",
    
    // Settings
    "settings.title": "Profile",
    "settings.language": "Language / Idioma / Langue",
    "settings.save": "Save Settings",
    "settings.personal_info": "Personal Info",
    "settings.vital_info": "Vital Intake Info",
    "settings.trusted_conn": "Trusted Community Connection",
    "settings.notifications": "Notifications"
  },
  es: {
    // General
    "app.name": "AERA",
    "btn.submit": "Enviar",
    "btn.next": "Siguiente",
    "btn.back": "Atrás",
    "btn.cancel": "Cancelar",
    "btn.save": "Guardar Configuración",
    "btn.confirm": "Confirmar",
    "btn.copy": "Copiar",
    "btn.apply": "Aplicar Ahora",
    "status.safe": "Seguro",
    "status.danger": "En Peligro",
    "status.unknown": "Desconocido",

    // Splash
    "splash.motto": "Mitigar • Comunicar • Responder • Recuperar",
    "splash.desc": "Una herramienta innovadora para respuesta a emergencias en tiempo real y ayuda comunitaria.",
    "splash.enter": "Entrar a la App",
    "splash.disclaimer": "No sustituye al 911",

    // Login
    "login.welcome": "Bienvenido",
    "login.subtitle": "Inicia sesión en tu cuenta AERA.",
    "login.phone_label": "Teléfono Móvil",
    "login.btn": "Iniciar Sesión",
    "login.demo_title": "Toque para iniciar sesión (Demo)",
    "login.no_account": "¿No tienes una cuenta?",
    "login.create": "Crear Cuenta",

    // Dashboard
    "dash.welcome": "Bienvenido",
    "dash.offline": "Modo sin conexión: los datos se sincronizarán cuando vuelva la señal",
    "dash.get_help": "Ayuda Ahora",
    "dash.report_emergency": "Reportar emergencia inmediatamente",
    "dash.request_active": "Solicitud Activa",
    "dash.tracking": "Respondedores rastreando ubicación.",
    "dash.resource_depot": "Depósito de Recursos",
    "dash.alerts": "Consola de Alertas",
    "dash.gap": "Centro G.A.P.",
    "dash.gap.desc": "Subvenciones y Pagos",
    "dash.assess": "Evaluaciones",
    "dash.assess.desc": "Reportar daños y necesidades",
    "dash.logistics": "Logística",
    "dash.logistics.desc": "Cadena de Suministro",
    "dash.manage_org": "Gestionar Organización",

    // GAP
    "gap.title": "Centro de Ayuda Financiera (G.A.P.)",
    "gap.subtitle": "Subvenciones • Anticipos • Pagos",
    "gap.funding_avail": "Fondos Disponibles",
    "gap.funding_desc": "Eres elegible para asistencia inmediata basada en tu ubicación.",
    "gap.grant.housing": "Beca de Vivienda de Emergencia",
    "gap.grant.housing_desc": "Apoyo para refugio temporal y reparaciones.",
    "gap.grant.business": "Ayuda a Pequeñas Empresas",
    "gap.grant.business_desc": "Apoyo para reemplazo de inventario.",
    "gap.status.open": "ABIERTO",
    "gap.status.pending": "PENDIENTE",
    "gap.no_advances": "No hay anticipos activos.",
    "gap.req_advance": "Solicitar Anticipo",

    // Logistics
    "logistics.title": "Inventario Minorista",
    "logistics.subtitle": "Integración de Cadena de Suministro en Vivo",
    "logistics.depot": "Depósito de Suministros Más Cercano",
    "logistics.retail_avail": "Disponibilidad Minorista (En Vivo)",

    // Alerts
    "alerts.title": "Alertas e Inteligencia",
    "alerts.search_placeholder": "Buscar noticias (ej. 'trayectoria tormenta')...",
    "alerts.official": "Transmisiones Oficiales",
    "alerts.quick_scan": "Escaneo Situacional Rápido",
    "alerts.ai_summary": "Resumen de Inteligencia en Vivo",
    "alerts.sources": "Fuentes y Verificación",

    // Org Dashboard
    "org.broadcast": "Transmitir",
    "org.verified": "HUB VERIFICADO",
    "org.code": "Código Comunitario",
    "org.tab.members": "Estado de Miembros",
    "org.tab.inventory": "Inventario del Hub",
    "org.manage_res": "Gestionar Recursos",
    "org.manage_desc": "Actualice sus niveles de stock. Datos visibles para usuarios cercanos.",
    "org.req_replenish": "Solicitar Reabastecimiento",
    "org.req_desc": "¿Poco stock? Solicite reabastecimiento inmediato.",
    "org.create_req": "Crear Solicitud",
    "org.submit_req": "Enviar Solicitud",

    // Help Form
    "help.title": "Reporte de Emergencia",
    "help.safe_q": "¿Estás a salvo ahora?",
    "help.yes_safe": "Sí, estoy a salvo",
    "help.no_danger": "No, estoy en peligro",
    "help.location": "Última Ubicación Conocida",
    "help.detecting": "Detectando coordenadas...",
    "help.manual": "Ingresar manualmente",
    "help.use_gps": "Usar GPS",
    "help.stop_share": "Dejar de Compartir",
    "help.what_need": "¿Qué necesitas?",
    "help.injured_q": "¿Hay alguien herido?",
    "help.situation": "Describe qué está pasando",
    "help.evac_q": "¿Puedes salir de tu ubicación?",
    "help.people_count": "¿Cuántas personas están contigo?",
    "help.pets_q": "¿Hay mascotas?",
    "help.resources_title": "Verificación de Recursos",
    "help.resources_desc": "¿Tienes acceso actualmente a:",
    "help.vuln_title": "Personas Vulnerables Presentes",
    "help.medical_cond": "Condiciones Médicas / Necesidades Especiales",
    "help.upload": "Subir Fotos / Video (Opcional)",
    "help.review": "Revisar y Enviar",
    "help.consent": "Doy mi consentimiento para compartir mi información con AERA y servicios de emergencia.",
    "help.submit_btn": "Enviar Solicitud de Emergencia",
    "help.success_title": "Solicitud Enviada",
    "help.success_desc": "Los servicios de emergencia han recibido tu solicitud y están rastreando tu ubicación.",
    "help.text_contact": "Notificar Contacto por SMS",
    "help.return_dash": "Volver al Tablero",

    // Registration
    "reg.title": "Configuración de Cuenta",
    "reg.skip": "Tengo una emergencia",
    "reg.skip_desc": "Saltar configuración y pedir ayuda",
    "reg.personal": "¿Quién eres?",
    "reg.personal_desc": "Info básica para respondedores.",
    "reg.vital": "Ingreso Vital",
    "reg.vital_desc": "Llenar esto ahorra tiempo crítico.",
    "reg.community": "Conexión Comunitaria",
    "reg.community_desc": "Lienzo a una institución de confiance.",
    "reg.safety": "Seguridad y Privacidad",
    "reg.complete": "Completar Configuración",
    
    // Settings
    "settings.title": "Perfil",
    "settings.language": "Idioma",
    "settings.save": "Guardar Configuración",
    "settings.personal_info": "Información Personal",
    "settings.vital_info": "Información Vital",
    "settings.trusted_conn": "Conexión Comunitaria",
    "settings.notifications": "Notificaciones"
  },
  fr: {
    // General
    "app.name": "AERA",
    "btn.submit": "Soumettre",
    "btn.next": "Suivant",
    "btn.back": "Retour",
    "btn.cancel": "Annuler",
    "btn.save": "Enregistrer",
    "btn.confirm": "Confirmer",
    "btn.copy": "Copier",
    "btn.apply": "Postuler",
    "status.safe": "En Sécurité",
    "status.danger": "En Danger",
    "status.unknown": "Inconnu",

    // Splash
    "splash.motto": "Atténuer • Communiquer • Répondre • Récupérer",
    "splash.desc": "Un outil innovant pour la réponse d'urgence en temps réel et l'aide communautaire.",
    "splash.enter": "Entrer dans l'App",
    "splash.disclaimer": "Ne remplace pas le 911",

    // Login
    "login.welcome": "Bienvenue",
    "login.subtitle": "Connectez-vous à votre compte AERA.",
    "login.phone_label": "Téléphone Mobile",
    "login.btn": "Se Connecter",
    "login.demo_title": "Appuyez pour vous connecter (Démo)",
    "login.no_account": "Pas de compte ?",
    "login.create": "Créer un Compte",

    // Dashboard
    "dash.welcome": "Bienvenue",
    "dash.offline": "Mode hors ligne actif",
    "dash.get_help": "Obtenir de l'aide",
    "dash.report_emergency": "Signaler une urgence",
    "dash.request_active": "Demande Active",
    "dash.tracking": "Localisation en cours.",
    "dash.resource_depot": "Dépôt de Ressources",
    "dash.alerts": "Console d'Alertes",
    "dash.gap": "Centre G.A.P.",
    "dash.gap.desc": "Subventions et Paiements",
    "dash.assess": "Évaluations",
    "dash.assess.desc": "Signaler dommages et besoins",
    "dash.logistics": "Logistique",
    "dash.logistics.desc": "Chaîne d'approvisionnement",
    "dash.manage_org": "Gérer l'Organisation",

    // GAP
    "gap.title": "Centre d'Aide Financière (G.A.P.)",
    "gap.subtitle": "Subventions • Avances • Paiements",
    "gap.funding_avail": "Fonds Disponibles",
    "gap.funding_desc": "Vous êtes éligible à une aide d'urgence immédiate.",
    "gap.grant.housing": "Subvention Logement d'Urgence",
    "gap.grant.housing_desc": "Aide pour abri temporaire et réparations.",
    "gap.grant.business": "Aide aux Petites Entreprises",
    "gap.grant.business_desc": "Soutien au remplacement de stock.",
    "gap.status.open": "OUVERT",
    "gap.status.pending": "EN ATTENTE",
    "gap.no_advances": "Pas d'avances actives.",
    "gap.req_advance": "Demander une Avance",

    // Logistics
    "logistics.title": "Inventaire de Détail",
    "logistics.subtitle": "Intégration Chaîne Logistique",
    "logistics.depot": "Dépôt le Plus Proche",
    "logistics.retail_avail": "Disponibilité Magasins (Direct)",

    // Alerts
    "alerts.title": "Alertes et Infos",
    "alerts.search_placeholder": "Scanner actus (ex. 'trajectoire tempête')...",
    "alerts.official": "Diffusions Officielles",
    "alerts.quick_scan": "Scan Situationnel Rapide",
    "alerts.ai_summary": "Résumé d'Intelligence en Direct",
    "alerts.sources": "Sources et Vérification",

    // Org Dashboard
    "org.broadcast": "Diffuser",
    "org.verified": "HUB VÉRIFIÉ",
    "org.code": "Code Communautaire",
    "org.tab.members": "Statut Membres",
    "org.tab.inventory": "Inventaire Hub",
    "org.manage_res": "Gérer Ressources",
    "org.manage_desc": "Mettez à jour vos stocks. Visible pour les utilisateurs proches.",
    "org.req_replenish": "Demander Réapprovisionnement",
    "org.req_desc": "Stock faible ? Demandez un réapprovisionnement immédiat.",
    "org.create_req": "Créer Demande",
    "org.submit_req": "Envoyer Demande",

    // Help Form
    "help.title": "Rapport d'Urgence",
    "help.safe_q": "Êtes-vous en sécurité ?",
    "help.yes_safe": "Oui, en sécurité",
    "help.no_danger": "Non, en danger",
    "help.location": "Dernière Position Connue",
    "help.detecting": "Détection...",
    "help.manual": "Saisie manuelle",
    "help.use_gps": "Utiliser GPS",
    "help.stop_share": "Arrêter le partage",
    "help.what_need": "De quoi avez-vous besoin ?",
    "help.injured_q": "Y a-t-il des blessés ?",
    "help.situation": "Décrivez la situation",
    "help.evac_q": "Pouvez-vous partir ?",
    "help.people_count": "Combien de personnes ?",
    "help.pets_q": "Y a-t-il des animaux ?",
    "help.resources_title": "Vérification des Ressources",
    "help.resources_desc": "Avez-vous accès à :",
    "help.vuln_title": "Personnes Vulnérables",
    "help.medical_cond": "Conditions Médicales",
    "help.upload": "Télécharger Photos / Vidéo",
    "help.review": "Vérifier et Soumettre",
    "help.consent": "Je consens à partager mes informations pour recevoir de l'aide.",
    "help.submit_btn": "Envoyer Demande",
    "help.success_title": "Demande Envoyée",
    "help.success_desc": "Les secours ont reçu votre demande et suivent votre position.",
    "help.text_contact": "Notifier par SMS",
    "help.return_dash": "Retour au Tableau de Bord",

    // Registration
    "reg.title": "Configuration du Compte",
    "reg.skip": "J'ai une urgence",
    "reg.skip_desc": "Demander de l'aide maintenant",
    "reg.personal": "Qui êtes-vous ?",
    "reg.personal_desc": "Infos de contact de base.",
    "reg.vital": "Infos Vitales",
    "reg.vital_desc": "Gagnez du temps en urgence.",
    "reg.community": "Connexion Communautaire",
    "reg.community_desc": "Lien vers une institution de confiance.",
    "reg.safety": "Sécurité et Confidentialité",
    "reg.complete": "Terminer",
    
    // Settings
    "settings.title": "Profil",
    "settings.language": "Langue",
    "settings.save": "Enregistrer",
    "settings.personal_info": "Infos Personnelles",
    "settings.vital_info": "Infos Vitales",
    "settings.trusted_conn": "Connexion Communautaire",
    "settings.notifications": "Notifications"
  }
};

export const t = (key: string): string => {
  const profile = StorageService.getProfile();
  const lang = profile.language || 'en';
  const dict = DICTIONARY[lang as LanguageCode] || DICTIONARY.en;
  return dict[key] || DICTIONARY.en[key] || key;
};

// Helper to get current language code directly
export const getCurrentLanguage = (): LanguageCode => {
  const lang = StorageService.getProfile().language || 'en';
  return (lang in DICTIONARY ? (lang as LanguageCode) : 'en');
}
