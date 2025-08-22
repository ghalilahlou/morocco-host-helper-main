export default {
  // Commun
  'common.previous': 'Précédent',
  'common.clear': 'Effacer',
  'common.loading': 'Chargement…',

  // Accueil invité
  'guest.invalidLink.title': 'Lien invalide',
  'guest.invalidLink.desc': "Ce lien de vérification n'est plus valide ou a expiré.",
  'guest.welcome.title': 'Bienvenue dans votre espace de check-in',
  'guest.welcome.subtitle': 'Vous êtes sur le point de compléter votre check-in en ligne de manière simple et sécurisée',
  'guest.welcome.secure': 'Sécurisé',
  'guest.welcome.duration': '2 minutes',
  'guest.checkin.title': 'Check-in pour {{propertyName}}',
  'guest.cta.startCheckin': 'Démarrer le check-in',
  'guest.steps.title': 'Étapes de votre check-in',
  'guest.steps.subtitle': 'Voici ce qui vous attend — simple et rapide',
  'guest.steps.1.title': "1. Téléversez votre pièce d'identité",
  'guest.steps.1.desc': "Carte d'identité ou passeport du voyageur principal (photo lisible)",
  'guest.steps.2.title': '2. Vérifiez vos informations',
  'guest.steps.2.desc': "Nous pré-remplissons quand c'est possible, vous confirmez en 1 minute",
  'guest.steps.3.title': '3. Signez le contrat',
  'guest.steps.3.desc': 'Signature électronique du contrat de location courte durée',
  'guest.footer.needHelp': "Besoin d'aide ?",
  'guest.footer.contactSupport': 'Contactez notre support',
  'guest.footer.terms': "conditions d'utilisation",
  'guest.footer.privacy': 'politique de confidentialité',

  // Signature de contrat
  'guest.contract.loading': 'Chargement du contrat…',
  'guest.contract.errorTitle': 'Erreur',
  'guest.contract.errorGeneric': 'Erreur lors du chargement des données',
  'guest.contract.backHome': "Retour à l'accueil",
  'guest.contract.signed.title': 'Contrat signé!',
  'guest.contract.signed.desc': 'Votre signature a été enregistrée avec succès. Le contrat signé est maintenant disponible pour le propriétaire.',
  'guest.contract.signed.thanks': "Merci d'avoir complété le processus de vérification.",
  'guest.contract.missingData.title': 'Données manquantes',
  'guest.contract.missingData.desc': 'Veuillez d\'abord compléter le formulaire de vérification avant de signer le contrat.',
  'guest.contract.missingData.cta': 'Compléter la vérification',

  // ContractSignature
  'contractSignature.pill': 'Signature du contrat',
  'contractSignature.title': 'Contrat de location saisonnière',
  'contractSignature.subtitle': 'Veuillez lire attentivement le contrat ci-dessous et signer électroniquement',
  'contractSignature.cardTitle': 'Contrat de location',
  'contractSignature.generating': 'Génération du contrat…',
  'contractSignature.retry': 'Réessayer',
  'contractSignature.preparing': 'Préparation du contrat…',
  'contractSignature.electronic': 'Signature électronique',
  'contractSignature.agreeLabel': "J'ai lu et j'accepte les termes et conditions du contrat de location",
  'contractSignature.startSigning': 'Commencer la signature',
  'contractSignature.signHere': 'Signez dans la zone ci-dessous:',
  'contractSignature.saving': 'Enregistrement...',
  'contractSignature.signContract': 'Signer le contrat',
  'contractSignature.mustAgree': 'Vous devez lire et accepter les termes du contrat avant de pouvoir le signer.',
  'contractSignature.toast.success.title': 'Contrat signé avec succès',
  'contractSignature.toast.success.desc': 'Votre signature a été enregistrée et la réservation marquée comme complétée.',
  'contractSignature.toast.error.title': 'Erreur',
  'contractSignature.toast.error.desc': "Impossible d'enregistrer la signature. Veuillez réessayer.",

  // GuestVerification (partiel)
  'airbnb.errorSync.title': 'Erreur de synchronisation',
  'airbnb.errorSync.desc': 'Impossible de récupérer les données du calendrier Airbnb',
  'airbnb.codeFound.title': 'Code Airbnb trouvé !',
  'airbnb.codeFound.desc': 'Réservation trouvée : {{checkIn}} au {{checkOut}}',
  'airbnb.codeDetected.title': 'Code Airbnb détecté',
  'airbnb.codeDetected.desc': 'Code {{code}} détecté. Sélectionnez les dates de votre réservation Airbnb ci-dessous.',
  'upload.error.notImage.title': 'Erreur',
  'upload.error.notImage.desc': '{{filename}}: Veuillez sélectionner une image (JPG, PNG, etc.)',
  'upload.docInvalid.title': 'Document non valide',
  'upload.docInvalid.desc': "Ce document ne semble pas être un document d'identité valide (passeport, carte nationale, permis de conduire). Veuillez télécharger un document d'identité officiel ou remplir les informations manuellement. Vous devrez peut-être refaire votre check-in si les documents chargés ne sont pas des pièces d'identité.",
  'upload.docNotRecognized.title': 'Document non reconnu',
  'upload.docNotRecognized.desc': "Ce document n'a pas pu être traité automatiquement. Assurez-vous qu'il s'agit d'un document d'identité officiel (passeport, carte nationale, permis de conduire) ou remplissez les informations manuellement.",
  'upload.warning.title': 'Avertissement',
  'upload.warning.desc': "Extraction automatique échouée. Veuillez saisir les informations manuellement.",
  'removeDoc.deleted.title': 'Document supprimé',
  'removeDoc.deleted.desc': 'Le document et les informations associées ont été supprimés',
  'validation.error.title': 'Erreur',
  'validation.selectDates.desc': "Veuillez sélectionner les dates d'arrivée et de départ",
  'validation.dateFuture.desc': "La date d'arrivée doit être aujourd'hui ou dans le futur",
  'validation.checkoutAfterCheckin.desc': "La date de départ doit être postérieure à la date d'arrivée",
  'validation.exactDocs.desc': "Veuillez télécharger exactement {{count}} document{{s}} d'identité (un par client)",
  'validation.completeGuests.desc': 'Veuillez compléter toutes les informations des clients',
  
  // Steps
  'guest.steps.step1.title': '1. Téléversez votre pièce d\'identité',
  'guest.steps.step1.desc': 'Carte d\'identité ou passeport du voyageur principal (photo lisible)',
  'guest.steps.step2.title': '2. Vérifiez vos informations',
  'guest.steps.step2.desc': 'Nous pré-remplissons quand c\'est possible, vous confirmez en 1 minute',
  'guest.steps.step3.title': '3. Signez le contrat',
  'guest.steps.step3.desc': 'Signature électronique du contrat de location courte durée',
  
  // Verification
  'guest.verification.title': 'Vérification des clients',
  'guest.verification.subtitle': 'Veuillez fournir vos informations pour la propriété: {{propertyName}}',
  
  // Booking
  'guest.booking.title': 'Informations de réservation',
  'guest.booking.checkIn': 'Date d\'arrivée',
  'guest.booking.checkOut': 'Date de départ',
  'guest.booking.numberOfGuests': 'Nombre de clients',
  'guest.booking.selectDate': 'Sélectionner',
  
  // Documents
  'guest.documents.title': 'Documents d\'identité',
  'guest.documents.dropzone': 'Glissez-déposez vos documents d\'identité ici ou cliquez pour sélectionner',
  'guest.documents.autoExtract': 'Les informations seront extraites automatiquement',
  'guest.documents.selectFiles': 'Sélectionner des documents',
  
  // Clients
  'guest.clients.title': 'Informations des clients',
  'guest.clients.clientNumber': 'Client {{number}}',
  'guest.clients.fullName': 'Nom complet',
  'guest.clients.fullNamePlaceholder': 'Nom et prénom',
  'guest.clients.dateOfBirth': 'Date de naissance',
  'guest.clients.nationality': 'Nationalité',
  'guest.clients.uploadFirst': 'Uploadez d\'abord votre document',
  'guest.clients.documentType': 'Type de document',
  'guest.clients.passport': 'Passeport',
  'guest.clients.nationalId': 'Carte d\'identité',
  'guest.clients.documentNumber': 'Numéro de document',
  'guest.clients.documentNumberPlaceholder': 'Numéro de passeport/CIN',
  
  // Navigation
  'guest.navigation.previous': 'Précédent',
  'guest.navigation.next': 'Suivant',
  
  // CTA
  'guest.cta.sendInfo': 'Envoyer les informations',
  
  // Documents uploaded
  'guest.documents.uploaded': 'Documents téléchargés:',
  
  // Documents viewer
  'documents.reservationTitle': 'Documents de la réservation',
  'documents.close': 'Fermer',
  'documents.guestIdDocuments': 'Documents d\'identité clients',
  'documents.view': 'Voir',
  'documents.download': 'Télécharger',
  'documents.noIdDocuments': 'Pas de pièce d\'identité disponible',
  'documents.rentalContract': 'Contrat de location',
  'documents.generated': 'Généré',
  'documents.contractNotGenerated': 'Contrat non généré',
  'documents.policeForms': 'Fiches de Police',
  'documents.policeForm': 'Fiche de police',
  'documents.policeFormNotGenerated': 'Fiche de police non générée',
} as Record<string, string>;