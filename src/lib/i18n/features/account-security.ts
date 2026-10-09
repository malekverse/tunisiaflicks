// Strings for: Account safety checks in Settings (confirming an email change, signing in again
// before sensitive changes, and what a TV signed in with a code may not change).
import { defineStrings } from '../define'

export const accountSecurity = defineStrings({
  en: {
    'accountSecurity.emailPasswordHint': 'To change your email, confirm it\'s you with your current password.',
    'accountSecurity.reauthTitle': 'Sign in again to continue',
    'accountSecurity.reauthEmail': 'For your safety, changing your email needs a recent sign-in. Sign in again, then change it.',
    'accountSecurity.reauthPassword': 'For your safety, setting a password needs a recent sign-in. Sign in again, then set it.',
    'accountSecurity.reauthButton': 'Sign in again',
    'accountSecurity.tvSession': 'This can\'t be changed from a TV. Use your phone or computer.',
  },
  ar: {
    'accountSecurity.emailPasswordHint': 'لتغيير بريدك الإلكتروني، أكّد هويتك بكلمة المرور الحالية.',
    'accountSecurity.reauthTitle': 'سجّل الدخول من جديد للمتابعة',
    'accountSecurity.reauthEmail': 'لحماية حسابك، يتطلّب تغيير البريد الإلكتروني تسجيل دخول حديثًا. سجّل الدخول من جديد ثم غيّره.',
    'accountSecurity.reauthPassword': 'لحماية حسابك، يتطلّب تعيين كلمة مرور تسجيل دخول حديثًا. سجّل الدخول من جديد ثم عيّنها.',
    'accountSecurity.reauthButton': 'سجّل الدخول من جديد',
    'accountSecurity.tvSession': 'لا يمكن تغيير هذا من التلفاز. استعمل هاتفك أو حاسوبك.',
  },
  tn: {
    'accountSecurity.emailPasswordHint': 'باش تبدّل الإيميل، أكّد إلي إنت بكلمة السر متاعك.',
    'accountSecurity.reauthTitle': 'أدخل من جديد باش تكمّل',
    'accountSecurity.reauthEmail': 'باش نحميو حسابك، تبديل الإيميل يستحق دخول جديد. أدخل من جديد وبعد بدّلو.',
    'accountSecurity.reauthPassword': 'باش نحميو حسابك، زيادة كلمة سر تستحق دخول جديد. أدخل من جديد وبعد زيدها.',
    'accountSecurity.reauthButton': 'أدخل من جديد',
    'accountSecurity.tvSession': 'ما تنجمش تبدّل هذا من التلفزة. استعمل التليفون ولا الكمبيوتر.',
  },
  fr: {
    'accountSecurity.emailPasswordHint': 'Pour changer votre adresse e-mail, confirmez votre identité avec votre mot de passe actuel.',
    'accountSecurity.reauthTitle': 'Reconnectez-vous pour continuer',
    'accountSecurity.reauthEmail': 'Pour votre sécurité, changer d’adresse e-mail demande une connexion récente. Reconnectez-vous, puis modifiez-la.',
    'accountSecurity.reauthPassword': 'Pour votre sécurité, définir un mot de passe demande une connexion récente. Reconnectez-vous, puis définissez-le.',
    'accountSecurity.reauthButton': 'Se reconnecter',
    'accountSecurity.tvSession': 'Ce réglage ne peut pas être modifié depuis une télévision. Utilisez votre téléphone ou votre ordinateur.',
  },
})
