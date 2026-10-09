// The About / Privacy / Terms / DMCA pages in French (see ./legal.ts for the other languages and
// for how the pages use them). Same content as the English text; same caveat: a sensible starting
// point, not legal advice.
import type { LegalDoc, LegalPageId } from '@/src/lib/legal'

export const fr: Record<LegalPageId, LegalDoc> = {
  about: {
    title: 'À propos de TunisiaFlicks',
    description: 'Ce qu’est TunisiaFlicks, comment il fonctionne et qui le fait.',
    intro: 'TunisiaFlicks vous aide à trouver quelque chose de bien à regarder\u00a0: des films et des séries du monde entier, un catalogue de séries et de films tunisiens, et des attentions personnelles comme Reprendre la lecture, des recommandations, des listes et des alertes de sortie.',
    sections: [
      {
        heading: 'Comment ça marche',
        bullets: [
          'Les titres, affiches, distributions et notes viennent de The Movie Database (TMDB). TunisiaFlicks utilise l’API de TMDB mais n’est ni approuvé ni certifié par TMDB.',
          'Les bandes-annonces sont des vidéos YouTube intégrées depuis YouTube.',
          'Les lecteurs vidéo et les sources de téléchargement sont fournis par des services tiers indépendants. TunisiaFlicks n’héberge, ne met en ligne et ne stocke aucun fichier vidéo.',
          'Le catalogue tunisien est construit à partir de listes publiques et renvoie vers les pages d’origine.',
          'Le site parle anglais, français, arabe et tunisien. Les titres et les résumés suivent votre langue quand TMDB en a une traduction.',
        ],
      },
      {
        heading: 'Votre compte',
        paragraphs: [
          'Un compte est gratuit et facultatif. Il garde vos favoris, votre liste À voir, votre historique, vos listes, vos profils et vos alertes, synchronisés sur tous vos appareils. Vous pouvez télécharger ou supprimer vos données à tout moment depuis les paramètres.',
        ],
      },
      {
        heading: 'Nous écrire',
        paragraphs: [
          'Idées, bugs ou questions\u00a0: la page de contact est là pour ça. Les titulaires de droits peuvent signaler un contenu depuis la page Droits d’auteur.',
        ],
      },
    ],
  },
  privacy: {
    title: 'Politique de confidentialité',
    description: 'Les données que TunisiaFlicks collecte, pourquoi, et les choix dont vous disposez.',
    intro: 'Nous collectons le strict nécessaire pour faire fonctionner le service, nous ne vendons jamais vos données, et vous pouvez les exporter ou les supprimer quand vous le souhaitez.',
    sections: [
      {
        heading: 'Ce que nous collectons',
        bullets: [
          'Les informations du compte\u00a0: votre nom, votre adresse e-mail, votre photo et un mot de passe chiffré de façon sûre (jamais le mot de passe lui-même). Si vous vous connectez avec Google, Google nous transmet votre nom, votre adresse e-mail et votre photo.',
          'Votre activité sur TunisiaFlicks\u00a0: favoris, liste À voir, historique, listes, profils, titres suivis et préférences de notification.',
          'Si vous activez les notifications\u00a0: l’adresse que votre navigateur nous donne pour les envoyer (un abonnement push), votre langue et les notifications choisies. Les désactiver la supprime.',
          'La langue de l’interface (anglais, français, arabe ou tunisien)\u00a0: conservée dans un cookie sur cet appareil et, quand vous avez ouvert une session, avec votre compte et vos abonnements aux notifications, pour que les e-mails et les notifications vous arrivent dans cette langue.',
          'Des données techniques\u00a0: votre adresse IP sert brièvement à protéger les connexions et les formulaires contre les abus (limitation du nombre de tentatives) et n’est pas conservée plus d’une journée.',
          'Des cookies\u00a0: un cookie de session pour rester connecté, et de petits cookies de préférences pour votre langue et votre profil actif. Nous n’utilisons aucun cookie publicitaire.',
          'Des statistiques\u00a0: des statistiques de pages anonymes et sans cookies (Vercel Web Analytics) pour savoir quelles pages sont utilisées.',
        ],
      },
      {
        heading: 'Ce que nous en faisons',
        bullets: [
          'Faire fonctionner les fonctions de votre compte (synchronisation, recommandations, alertes, bilan de l’année).',
          'Envoyer les e-mails que vous demandez\u00a0: réinitialisation du mot de passe, confirmation de l’adresse et alertes de sortie.',
          'Afficher des tendances anonymes («\u202fTendances sur TunisiaFlicks\u202f»)\u00a0: uniquement le nombre de comptes qui ont regardé un titre, et seulement une fois que plusieurs comptes différents l’ont fait.',
          'Assurer la sécurité du service et corriger les problèmes.',
        ],
      },
      {
        heading: 'Avec qui nous les partageons',
        paragraphs: [
          'Nous ne vendons ni ne louons vos données. Elles ne sont traitées que par les prestataires qui font tourner le service\u00a0: l’hébergement (Vercel), la base de données (MongoDB Atlas) et l’envoi des e-mails. Quand vous lancez la lecture, le lecteur choisi est un service tiers qui a sa propre politique de confidentialité, tout comme les bandes-annonces YouTube.',
        ],
      },
      {
        heading: 'Amis et notes',
        paragraphs: [
          'Les amis, les notes et votre page restent désactivés tant que vous ne les activez pas. Chaque profil peut créer une page avec un identifiant et choisir qui voit son activité et ses notes : vous seul, ou vos amis (les notes peuvent aussi être visibles par toute personne ayant votre lien).',
          'Vos amis voient ce que vous avez regardé avec un délai, et seulement depuis le moment où vous avez activé le partage. Un mot joint à une recommandation est limité à 140 caractères ; il n’y a pas de messagerie. Un blocage s’applique à tout le compte. Supprimer une page ou un compte supprime ses amitiés, invitations, notes et notifications. Les profils Enfants n’ont jamais de page.',
        ],
      },
      {
        heading: 'E-mails',
        paragraphs: [
          'La lettre hebdomadaire est facultative, propre à chaque profil, et envoyée à l’adresse confirmée de votre compte. Elle ne contient ni pixel de suivi ni lien traqué, et chaque e-mail se désabonne en un clic. Nous gardons une trace de chaque envoi pendant 120 jours. Les e-mails d’alertes de sortie ont leur propre interrupteur pour tout le compte, dans les Réglages.',
        ],
      },
      {
        heading: 'Langue de l’interface',
        paragraphs: [
          'Nous retenons la langue de l’interface (anglais, français, arabe ou tunisien) dans un cookie, et dans votre compte quand vous êtes connecté, pour que le site s’ouvre dans votre langue.',
        ],
      },
      {
        heading: 'Vos choix et vos droits',
        bullets: [
          'Exporter\u00a0: téléchargez une copie de vos données depuis les paramètres.',
          'Rectifier\u00a0: modifiez votre nom, votre adresse e-mail et votre photo depuis les paramètres.',
          'Supprimer\u00a0: supprimez votre compte et toutes ses données depuis les paramètres. La suppression est définitive.',
          'Vous pouvez aussi envoyer vos questions ou vos demandes depuis la page de contact.',
        ],
      },
      {
        heading: 'Enfants',
        paragraphs: [
          'Les comptes sont destinés aux personnes de 13 ans et plus. Les parents peuvent créer des profils Enfants, qui ne montrent que des titres adaptés aux enfants.',
        ],
      },
      {
        heading: 'Modifications',
        paragraphs: ['Si cette politique change, la date en haut de cette page changera aussi. Les changements importants seront annoncés sur le site.'],
      },
    ],
  },
  terms: {
    title: 'Conditions d’utilisation',
    description: 'Les règles d’utilisation de TunisiaFlicks.',
    intro: 'En utilisant TunisiaFlicks, vous acceptez ces conditions. Si vous ne les acceptez pas, n’utilisez pas le service.',
    sections: [
      {
        heading: 'Le service',
        paragraphs: [
          'TunisiaFlicks est un catalogue gratuit pour découvrir des films et des séries. Les informations sur les titres viennent de TMDB. TunisiaFlicks n’héberge, ne met en ligne et ne stocke aucun fichier vidéo\u00a0: les lecteurs, les flux et les sources de téléchargement affichés sur le site sont fournis par des tiers indépendants, et nous ne contrôlons ni leur contenu ni leur disponibilité.',
        ],
      },
      {
        heading: 'Votre compte',
        bullets: [
          'Donnez des informations exactes et gardez votre mot de passe en lieu sûr. Vous êtes responsable de l’activité de votre compte.',
          'Un compte par personne\u202f; les profils sont destinés aux membres de votre foyer.',
          'Nous pouvons suspendre les comptes qui enfreignent ces conditions.',
        ],
      },
      {
        heading: 'Utilisation acceptable',
        bullets: [
          'N’utilisez pas le service à des fins illégales, ni pour porter atteinte aux droits d’autrui.',
          'N’attaquez pas le service, ne le surchargez pas, n’en aspirez pas les données et ne tentez pas d’en contourner la sécurité.',
          'Les listes publiques et tout ce que vous publiez ne doivent être ni offensants, ni trompeurs, ni contrefaisants. Nous pouvons retirer ces contenus.',
        ],
      },
      {
        heading: 'Contenus de tiers',
        paragraphs: [
          'Les liens, les lecteurs intégrés, les bandes-annonces et les sources de téléchargement mènent à des services que nous n’exploitons pas. Utilisez-les à votre discrétion et dans le respect de la loi de votre pays. Les titulaires de droits peuvent signaler un contenu depuis la page Droits d’auteur, et nous donnons suite aux notifications valables.',
        ],
      },
      {
        heading: 'Absence de garantie et limitation de responsabilité',
        paragraphs: [
          'Le service est fourni «\u202ftel quel\u202f», sans garantie d’aucune sorte. Dans les limites permises par la loi, TunisiaFlicks n’est pas responsable des dommages indirects ou consécutifs liés à son utilisation, ou aux contenus et services de tiers.',
        ],
      },
      {
        heading: 'Modifications et contact',
        paragraphs: [
          'Nous pouvons mettre à jour ces conditions\u202f; la date en haut de cette page indique la dernière version. Vos questions sont les bienvenues sur la page de contact.',
        ],
      },
    ],
  },
  dmca: {
    title: 'Droits d’auteur et DMCA',
    description: 'Comment les titulaires de droits peuvent signaler un contenu sur TunisiaFlicks.',
    intro: 'TunisiaFlicks respecte les droits des créateurs. Nous n’hébergeons aucun fichier vidéo sur nos serveurs\u00a0: nos pages affichent des informations de TMDB et renvoient vers des contenus hébergés par des tiers indépendants, ou les intègrent. Si vous pensez qu’une page de TunisiaFlicks renvoie vers un contenu qui porte atteinte à vos droits d’auteur, ou l’intègre, envoyez-nous une notification et nous retirerons le lien ou l’intégration.',
    sections: [
      {
        heading: 'Ce que doit contenir une notification',
        bullets: [
          'Votre nom et vos coordonnées (une adresse e-mail à laquelle nous pouvons répondre).',
          'L’œuvre protégée à laquelle il serait porté atteinte.',
          'L’adresse exacte (URL) de la ou des pages de TunisiaFlicks où le contenu apparaît.',
          'Une déclaration indiquant que vous pensez de bonne foi que cette utilisation n’est autorisée ni par le titulaire des droits, ni par son représentant, ni par la loi.',
          'Une déclaration indiquant que les informations de la notification sont exactes et, sous peine de parjure, que vous êtes titulaire des droits ou que vous avez le pouvoir d’agir en son nom.',
          'Votre signature physique ou électronique (saisir votre nom complet suffit).',
        ],
      },
      {
        heading: 'La suite',
        paragraphs: [
          'Nous examinons les notifications rapidement, en général sous quelques jours ouvrés, et retirons ou désactivons les liens ou intégrations signalés quand la notification est valable. Comme les fichiers eux-mêmes sont hébergés ailleurs, nous vous conseillons aussi de prévenir directement l’hébergeur.',
          'Si vous pensez qu’un contenu a été retiré par erreur, vous pouvez envoyer une contre-notification depuis le même formulaire, avec les informations ci-dessus. Les comptes qui publient de façon répétée des contenus contrefaisants peuvent être fermés.',
        ],
      },
    ],
  },
}
