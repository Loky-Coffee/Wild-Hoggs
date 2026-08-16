/**
 * Texte der Reset-Mail in allen 15 Sprachen der Seite.
 *
 * Bewusst nicht aus src/i18n/ geholt: Das sind Astro-Module für den Browser,
 * die Functions laufen in einer anderen Umgebung. Ein Import würde die ganze
 * Sprachdatei (über tausend Schlüssel) in jeden Worker-Aufruf ziehen, um vier
 * Sätze zu bekommen. Hier stehen nur diese vier Sätze.
 *
 * Zum HTML: Mailprogramme können kein externes CSS, kein <style> im <head>,
 * kein flex, kein grid. Was hier steht, ist absichtlich altmodisch — Tabellen,
 * Inline-Attribute, feste Breiten. Das ist keine Nachlässigkeit, sondern der
 * kleinste gemeinsame Nenner von Outlook bis Gmail.
 */

interface Texte {
  betreff: string;
  /** "Hallo {name}," */
  anrede: string;
  einleitung: string;
  knopf: string;
  /** "Der Link gilt {n} Minuten." */
  gueltig: string;
  ignorieren: string;
  fallback: string;
  abbinder: string;
}

const TEXTE: Record<string, Texte> = {
  en: {
    betreff: 'Reset your Wild Hoggs password',
    anrede: 'Hi {name},',
    einleitung: 'Someone asked to reset the password for your Wild Hoggs account. If that was you, click the button below to choose a new one.',
    knopf: 'Set a new password',
    gueltig: 'This link works for {n} minutes and can only be used once.',
    ignorieren: 'If you did not ask for this, you can ignore this message. Your password stays as it is.',
    fallback: 'Button not working? Copy this address into your browser:',
    abbinder: 'Wild Hoggs — a fan-made toolbox for Last Z: Survival Shooter. Not affiliated with the game or its developers.',
  },
  de: {
    betreff: 'Neues Passwort für Wild Hoggs',
    anrede: 'Hallo {name},',
    einleitung: 'Jemand hat ein neues Passwort für dein Wild-Hoggs-Konto angefordert. Warst du das, dann wähle über die Schaltfläche unten ein neues.',
    knopf: 'Neues Passwort wählen',
    gueltig: 'Der Link gilt {n} Minuten und lässt sich nur einmal verwenden.',
    ignorieren: 'Hast du das nicht angefordert, ignoriere diese Nachricht einfach. Dein Passwort bleibt, wie es ist.',
    fallback: 'Schaltfläche funktioniert nicht? Kopiere diese Adresse in deinen Browser:',
    abbinder: 'Wild Hoggs — von Fans gemachte Rechner für Last Z: Survival Shooter. Keine Verbindung zum Spiel oder seinen Entwicklern.',
  },
  fr: {
    betreff: 'Réinitialiser votre mot de passe Wild Hoggs',
    anrede: 'Bonjour {name},',
    einleitung: 'Quelqu’un a demandé la réinitialisation du mot de passe de votre compte Wild Hoggs. Si c’était vous, cliquez sur le bouton ci-dessous pour en choisir un nouveau.',
    knopf: 'Choisir un nouveau mot de passe',
    gueltig: 'Ce lien est valable {n} minutes et ne peut servir qu’une seule fois.',
    ignorieren: 'Si vous n’êtes pas à l’origine de cette demande, ignorez ce message. Votre mot de passe reste inchangé.',
    fallback: 'Le bouton ne fonctionne pas ? Copiez cette adresse dans votre navigateur :',
    abbinder: 'Wild Hoggs — une boîte à outils créée par des fans pour Last Z: Survival Shooter. Sans lien avec le jeu ni ses développeurs.',
  },
  es: {
    betreff: 'Restablece tu contraseña de Wild Hoggs',
    anrede: 'Hola {name}:',
    einleitung: 'Alguien ha solicitado restablecer la contraseña de tu cuenta de Wild Hoggs. Si fuiste tú, pulsa el botón de abajo para elegir una nueva.',
    knopf: 'Elegir contraseña nueva',
    gueltig: 'Este enlace funciona durante {n} minutos y solo se puede usar una vez.',
    ignorieren: 'Si no lo has solicitado, ignora este mensaje. Tu contraseña seguirá igual.',
    fallback: '¿El botón no funciona? Copia esta dirección en tu navegador:',
    abbinder: 'Wild Hoggs — herramientas hechas por aficionados para Last Z: Survival Shooter. Sin relación con el juego ni sus desarrolladores.',
  },
  it: {
    betreff: 'Reimposta la password di Wild Hoggs',
    anrede: 'Ciao {name},',
    einleitung: 'Qualcuno ha chiesto di reimpostare la password del tuo account Wild Hoggs. Se sei stato tu, usa il pulsante qui sotto per sceglierne una nuova.',
    knopf: 'Scegli una nuova password',
    gueltig: 'Il link è valido {n} minuti e può essere usato una sola volta.',
    ignorieren: 'Se non hai richiesto tu questa operazione, ignora il messaggio. La tua password resta invariata.',
    fallback: 'Il pulsante non funziona? Copia questo indirizzo nel browser:',
    abbinder: 'Wild Hoggs — strumenti creati dai fan per Last Z: Survival Shooter. Non affiliato al gioco né ai suoi sviluppatori.',
  },
  pt: {
    betreff: 'Redefinir a sua palavra-passe do Wild Hoggs',
    anrede: 'Olá {name},',
    einleitung: 'Alguém pediu para redefinir a palavra-passe da sua conta Wild Hoggs. Se foi você, clique no botão abaixo para escolher uma nova.',
    knopf: 'Escolher nova palavra-passe',
    gueltig: 'Esta ligação é válida durante {n} minutos e só pode ser usada uma vez.',
    ignorieren: 'Se não fez este pedido, ignore esta mensagem. A sua palavra-passe permanece inalterada.',
    fallback: 'O botão não funciona? Copie este endereço para o seu navegador:',
    abbinder: 'Wild Hoggs — ferramentas feitas por fãs para Last Z: Survival Shooter. Sem qualquer ligação ao jogo ou aos seus programadores.',
  },
  tr: {
    betreff: 'Wild Hoggs parolanızı sıfırlayın',
    anrede: 'Merhaba {name},',
    einleitung: 'Birisi Wild Hoggs hesabınızın parolasının sıfırlanmasını istedi. Bu sizseniz, yeni bir parola seçmek için aşağıdaki düğmeye tıklayın.',
    knopf: 'Yeni parola belirle',
    gueltig: 'Bu bağlantı {n} dakika geçerlidir ve yalnızca bir kez kullanılabilir.',
    ignorieren: 'Bu isteği siz yapmadıysanız bu iletiyi yok sayabilirsiniz. Parolanız değişmeden kalır.',
    fallback: 'Düğme çalışmıyor mu? Bu adresi tarayıcınıza kopyalayın:',
    abbinder: 'Wild Hoggs — Last Z: Survival Shooter için hayranlar tarafından yapılmış araçlar. Oyunla veya geliştiricileriyle bir bağlantısı yoktur.',
  },
  ja: {
    betreff: 'Wild Hoggs のパスワード再設定',
    anrede: '{name} さん',
    einleitung: 'Wild Hoggs アカウントのパスワード再設定が要求されました。お心当たりがある場合は、下のボタンから新しいパスワードを設定してください。',
    knopf: '新しいパスワードを設定',
    gueltig: 'このリンクは {n} 分間有効で、一度だけ使用できます。',
    ignorieren: 'お心当たりがない場合は、このメールを無視してください。パスワードは変更されません。',
    fallback: 'ボタンが動作しない場合は、次のアドレスをブラウザーに貼り付けてください:',
    abbinder: 'Wild Hoggs — Last Z: Survival Shooter のファンによる計算ツールです。ゲームおよび開発元とは関係ありません。',
  },
  ko: {
    betreff: 'Wild Hoggs 비밀번호 재설정',
    anrede: '{name}님, 안녕하세요.',
    einleitung: '누군가 회원님의 Wild Hoggs 계정 비밀번호 재설정을 요청했습니다. 본인이 맞다면 아래 버튼을 눌러 새 비밀번호를 정하세요.',
    knopf: '새 비밀번호 설정',
    gueltig: '이 링크는 {n}분 동안 유효하며 한 번만 사용할 수 있습니다.',
    ignorieren: '요청한 적이 없다면 이 메일은 무시하셔도 됩니다. 비밀번호는 그대로 유지됩니다.',
    fallback: '버튼이 작동하지 않나요? 아래 주소를 브라우저에 붙여넣으세요:',
    abbinder: 'Wild Hoggs — Last Z: Survival Shooter 팬이 만든 계산 도구입니다. 게임 및 개발사와는 무관합니다.',
  },
  id: {
    betreff: 'Setel ulang kata sandi Wild Hoggs Anda',
    anrede: 'Halo {name},',
    einleitung: 'Ada yang meminta penyetelan ulang kata sandi untuk akun Wild Hoggs Anda. Jika itu Anda, klik tombol di bawah untuk memilih kata sandi baru.',
    knopf: 'Pilih kata sandi baru',
    gueltig: 'Tautan ini berlaku {n} menit dan hanya dapat dipakai sekali.',
    ignorieren: 'Jika Anda tidak meminta ini, abaikan saja pesan ini. Kata sandi Anda tetap sama.',
    fallback: 'Tombol tidak berfungsi? Salin alamat ini ke peramban Anda:',
    abbinder: 'Wild Hoggs — perkakas buatan penggemar untuk Last Z: Survival Shooter. Tidak berafiliasi dengan gim atau pengembangnya.',
  },
  th: {
    betreff: 'ตั้งรหัสผ่าน Wild Hoggs ใหม่',
    anrede: 'สวัสดี {name}',
    einleitung: 'มีคนขอตั้งรหัสผ่านใหม่สำหรับบัญชี Wild Hoggs ของคุณ หากเป็นคุณเอง กดปุ่มด้านล่างเพื่อเลือกรหัสผ่านใหม่',
    knopf: 'ตั้งรหัสผ่านใหม่',
    gueltig: 'ลิงก์นี้ใช้ได้ {n} นาที และใช้ได้เพียงครั้งเดียว',
    ignorieren: 'หากคุณไม่ได้เป็นผู้ขอ ให้ละเว้นข้อความนี้ รหัสผ่านของคุณจะไม่เปลี่ยนแปลง',
    fallback: 'ปุ่มใช้งานไม่ได้ใช่ไหม คัดลอกที่อยู่นี้ไปวางในเบราว์เซอร์:',
    abbinder: 'Wild Hoggs — เครื่องมือที่แฟนเกมสร้างขึ้นสำหรับ Last Z: Survival Shooter ไม่มีส่วนเกี่ยวข้องกับเกมหรือผู้พัฒนา',
  },
  vi: {
    betreff: 'Đặt lại mật khẩu Wild Hoggs của bạn',
    anrede: 'Chào {name},',
    einleitung: 'Có người yêu cầu đặt lại mật khẩu cho tài khoản Wild Hoggs của bạn. Nếu đó là bạn, hãy nhấn nút bên dưới để chọn mật khẩu mới.',
    knopf: 'Chọn mật khẩu mới',
    gueltig: 'Liên kết này có hiệu lực trong {n} phút và chỉ dùng được một lần.',
    ignorieren: 'Nếu bạn không yêu cầu điều này, hãy bỏ qua thư này. Mật khẩu của bạn vẫn giữ nguyên.',
    fallback: 'Nút không hoạt động? Sao chép địa chỉ này vào trình duyệt của bạn:',
    abbinder: 'Wild Hoggs — bộ công cụ do người hâm mộ tạo cho Last Z: Survival Shooter. Không liên kết với trò chơi hay nhà phát triển.',
  },
  'zh-CN': {
    betreff: '重置你的 Wild Hoggs 密码',
    anrede: '你好，{name}：',
    einleitung: '有人请求重置你的 Wild Hoggs 账号密码。如果是你本人，请点击下面的按钮设置新密码。',
    knopf: '设置新密码',
    gueltig: '此链接 {n} 分钟内有效，且只能使用一次。',
    ignorieren: '如果这不是你发起的，忽略本邮件即可，你的密码不会改变。',
    fallback: '按钮打不开？把下面的地址复制到浏览器：',
    abbinder: 'Wild Hoggs — 由玩家制作的 Last Z: Survival Shooter 计算工具，与游戏及其开发方无关。',
  },
  'zh-TW': {
    betreff: '重設你的 Wild Hoggs 密碼',
    anrede: '你好，{name}：',
    einleitung: '有人要求重設你的 Wild Hoggs 帳號密碼。如果是你本人，請點選下方按鈕設定新密碼。',
    knopf: '設定新密碼',
    gueltig: '此連結 {n} 分鐘內有效，且僅能使用一次。',
    ignorieren: '若這不是你發起的，忽略本郵件即可，你的密碼不會變更。',
    fallback: '按鈕無法開啟？把下面的網址複製到瀏覽器：',
    abbinder: 'Wild Hoggs — 由玩家製作的 Last Z: Survival Shooter 計算工具，與遊戲及其開發商無關。',
  },
  ar: {
    betreff: 'إعادة تعيين كلمة مرور Wild Hoggs',
    anrede: 'مرحبًا {name}،',
    einleitung: 'طلب أحدهم إعادة تعيين كلمة مرور حسابك في Wild Hoggs. إن كنت أنت، فاضغط الزر أدناه لاختيار كلمة مرور جديدة.',
    knopf: 'اختيار كلمة مرور جديدة',
    gueltig: 'هذا الرابط صالح لمدة {n} دقيقة ويمكن استخدامه مرة واحدة فقط.',
    ignorieren: 'إن لم تطلب ذلك، فتجاهل هذه الرسالة. ستبقى كلمة مرورك كما هي.',
    fallback: 'الزر لا يعمل؟ انسخ هذا العنوان إلى متصفحك:',
    abbinder: 'Wild Hoggs — أدوات من صنع المعجبين للعبة Last Z: Survival Shooter. لا صلة لها باللعبة أو مطوّريها.',
  },
};

/**
 * Texte der Bestätigungsmail. Anrede, Fallback-Zeile und Abbinder kommen aus
 * TEXTE — die hängen nicht am Anlass.
 */
interface VerifyTexte {
  betreff: string;
  einleitung: string;
  knopf: string;
  /** "Der Link gilt {n} Tage." */
  gueltig: string;
  /** Warum überhaupt bestätigen. */
  warum: string;
}

const VERIFY: Record<string, VerifyTexte> = {
  en: {
    betreff: 'Confirm your email address',
    einleitung: 'Please confirm that this address belongs to you. One click is enough.',
    knopf: 'Confirm address',
    gueltig: 'This link works for {n} days.',
    warum: 'Why: a confirmed address is the only way we can get you back into your account if you ever forget your password.',
  },
  de: {
    betreff: 'Bestätige deine E-Mail-Adresse',
    einleitung: 'Bitte bestätige, dass diese Adresse dir gehört. Ein Klick genügt.',
    knopf: 'Adresse bestätigen',
    gueltig: 'Der Link gilt {n} Tage.',
    warum: 'Warum: Nur über eine bestätigte Adresse können wir dir zurück in dein Konto helfen, falls du dein Passwort einmal vergisst.',
  },
  fr: {
    betreff: 'Confirmez votre adresse e-mail',
    einleitung: 'Merci de confirmer que cette adresse est bien la vôtre. Un clic suffit.',
    knopf: 'Confirmer l’adresse',
    gueltig: 'Ce lien est valable {n} jours.',
    warum: 'Pourquoi : une adresse confirmée est le seul moyen de vous rendre l’accès à votre compte si vous oubliez votre mot de passe.',
  },
  es: {
    betreff: 'Confirma tu correo electrónico',
    einleitung: 'Confirma que esta dirección es tuya. Basta con un clic.',
    knopf: 'Confirmar dirección',
    gueltig: 'Este enlace funciona durante {n} días.',
    warum: 'Por qué: una dirección confirmada es la única forma de devolverte el acceso a tu cuenta si alguna vez olvidas la contraseña.',
  },
  it: {
    betreff: 'Conferma il tuo indirizzo e-mail',
    einleitung: 'Conferma che questo indirizzo è tuo. Basta un clic.',
    knopf: 'Conferma indirizzo',
    gueltig: 'Il link è valido {n} giorni.',
    warum: 'Perché: un indirizzo confermato è l’unico modo per farti rientrare nel tuo account se dimentichi la password.',
  },
  pt: {
    betreff: 'Confirme o seu e-mail',
    einleitung: 'Confirme que este endereço lhe pertence. Basta um clique.',
    knopf: 'Confirmar endereço',
    gueltig: 'Esta ligação é válida durante {n} dias.',
    warum: 'Porquê: um endereço confirmado é a única forma de lhe devolvermos o acesso à conta se um dia se esquecer da palavra-passe.',
  },
  tr: {
    betreff: 'E-posta adresinizi doğrulayın',
    einleitung: 'Bu adresin size ait olduğunu doğrulayın. Tek tık yeterli.',
    knopf: 'Adresi doğrula',
    gueltig: 'Bu bağlantı {n} gün geçerlidir.',
    warum: 'Neden: Parolanızı unutmanız hâlinde hesabınıza dönmenizi yalnızca doğrulanmış bir adres üzerinden sağlayabiliriz.',
  },
  ja: {
    betreff: 'メールアドレスの確認',
    einleitung: 'このアドレスがご本人のものであることをご確認ください。クリックするだけで完了します。',
    knopf: 'アドレスを確認',
    gueltig: 'このリンクは {n} 日間有効です。',
    warum: '確認が必要な理由: パスワードをお忘れになった際にアカウントへ戻れるのは、確認済みのアドレスがある場合のみです。',
  },
  ko: {
    betreff: '이메일 주소 확인',
    einleitung: '이 주소가 회원님의 것인지 확인해 주세요. 한 번만 누르면 됩니다.',
    knopf: '주소 확인',
    gueltig: '이 링크는 {n}일 동안 유효합니다.',
    warum: '확인이 필요한 이유: 비밀번호를 잊으셨을 때 계정을 되찾아 드릴 수 있는 방법은 확인된 주소뿐입니다.',
  },
  id: {
    betreff: 'Konfirmasi alamat e-mail Anda',
    einleitung: 'Mohon konfirmasi bahwa alamat ini milik Anda. Cukup satu klik.',
    knopf: 'Konfirmasi alamat',
    gueltig: 'Tautan ini berlaku {n} hari.',
    warum: 'Alasannya: alamat yang terkonfirmasi adalah satu-satunya cara kami mengembalikan akses akun Anda jika suatu saat lupa kata sandi.',
  },
  th: {
    betreff: 'ยืนยันอีเมลของคุณ',
    einleitung: 'กรุณายืนยันว่าอีเมลนี้เป็นของคุณ เพียงคลิกเดียวก็เสร็จ',
    knopf: 'ยืนยันอีเมล',
    gueltig: 'ลิงก์นี้ใช้ได้ {n} วัน',
    warum: 'เหตุผล: อีเมลที่ยืนยันแล้วเป็นทางเดียวที่เราจะช่วยให้คุณกลับเข้าบัญชีได้ หากคุณลืมรหัสผ่าน',
  },
  vi: {
    betreff: 'Xác nhận địa chỉ e-mail của bạn',
    einleitung: 'Vui lòng xác nhận địa chỉ này là của bạn. Chỉ cần một cú nhấp.',
    knopf: 'Xác nhận địa chỉ',
    gueltig: 'Liên kết này có hiệu lực trong {n} ngày.',
    warum: 'Lý do: địa chỉ đã xác nhận là cách duy nhất để chúng tôi giúp bạn lấy lại tài khoản nếu bạn quên mật khẩu.',
  },
  'zh-CN': {
    betreff: '确认你的邮箱地址',
    einleitung: '请确认这个邮箱是你本人的，点击一下即可。',
    knopf: '确认邮箱',
    gueltig: '此链接 {n} 天内有效。',
    warum: '为什么要确认：万一你忘记密码，只有通过已确认的邮箱才能帮你找回账号。',
  },
  'zh-TW': {
    betreff: '確認你的電子郵件地址',
    einleitung: '請確認這個信箱是你本人的，點一下即可。',
    knopf: '確認信箱',
    gueltig: '此連結 {n} 天內有效。',
    warum: '為什麼要確認：萬一你忘記密碼，只有透過已確認的信箱才能幫你找回帳號。',
  },
  ar: {
    betreff: 'أكّد بريدك الإلكتروني',
    einleitung: 'الرجاء تأكيد أن هذا العنوان يخصّك. نقرة واحدة تكفي.',
    knopf: 'تأكيد العنوان',
    gueltig: 'هذا الرابط صالح لمدة {n} أيام.',
    warum: 'السبب: العنوان المؤكَّد هو الوسيلة الوحيدة لإعادتك إلى حسابك إن نسيت كلمة المرور يومًا ما.',
  },
};

/** Sprachen, die von rechts nach links gesetzt werden. */
const RTL = new Set(['ar']);

/**
 * Entschärft Text für die Verwendung in HTML.
 *
 * Der Benutzername kommt aus der Datenbank und darf beim Anlegen fast alles
 * enthalten. Ohne diese Behandlung liesse sich über den eigenen Namen HTML in
 * die Mail schmuggeln — in der Mail des Empfängers, der derselbe ist, also
 * kein grosses Risiko; sauber ist es trotzdem nicht.
 */
function h(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export interface MailInhalt {
  betreff: string;
  html: string;
  text: string;
}

/** Bausteine einer Mail — gleich für Reset und Bestätigung. */
interface MailBausteine {
  sprache: string;
  anrede: string;
  einleitung: string;
  knopf: string;
  link: string;
  /** Kleingedrucktes unter dem Knopf, Zeile für Zeile. */
  hinweise: string[];
  fallback: string;
  abbinder: string;
}

/**
 * Baut die HTML- und Nur-Text-Fassung.
 *
 * Beide gehören dazu: Manche Programme zeigen nur Text an, und eine Mail ohne
 * Text-Teil gilt bei Spamfiltern als verdächtig — was bei einer Domain, die
 * gerade erst anfängt zu senden, besonders ins Gewicht fällt.
 */
function baueMail(b: MailBausteine): { html: string; text: string } {
  const rtl = RTL.has(b.sprache);
  const richtung = rtl ? 'rtl' : 'ltr';
  const seite = rtl ? 'right' : 'left';

  const text = [
    b.anrede,
    '',
    b.einleitung,
    '',
    b.link,
    '',
    ...b.hinweise,
    '',
    '—',
    b.abbinder,
  ].join('\n');

  const html = `<!DOCTYPE html>
<html lang="${h(b.sprache)}" dir="${richtung}">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#14100c;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#14100c;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:520px;background:#1e1811;border:1px solid #3a2e1f;border-radius:10px;">
<tr><td style="padding:28px 32px 8px;text-align:${seite};">
<div style="font:700 19px/1.3 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#ffa500;">Wild Hoggs</div>
</td></tr>
<tr><td style="padding:8px 32px 0;text-align:${seite};">
<p style="margin:0 0 14px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f0e6d8;">${h(b.anrede)}</p>
<p style="margin:0 0 22px;font:400 15px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f0e6d8;">${h(b.einleitung)}</p>
</td></tr>
<tr><td style="padding:0 32px 22px;text-align:center;">
<a href="${h(b.link)}" style="display:inline-block;padding:13px 28px;background:#ff9500;color:#1c1206;font:700 15px/1 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;text-decoration:none;border-radius:6px;">${h(b.knopf)}</a>
</td></tr>
<tr><td style="padding:0 32px 24px;text-align:${seite};">
${b.hinweise.map(z => `<p style="margin:0 0 10px;font:400 13px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#b8a892;">${h(z)}</p>`).join('\n')}
<p style="margin:14px 0 6px;font:400 12px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#8d8069;">${h(b.fallback)}</p>
<p style="margin:0;font:400 12px/1.5 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;color:#8d8069;word-break:break-all;" dir="ltr">${h(b.link)}</p>
</td></tr>
<tr><td style="padding:16px 32px 26px;border-top:1px solid #3a2e1f;text-align:${seite};">
<p style="margin:0;font:400 11px/1.5 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#7a6e5a;">${h(b.abbinder)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  return { html, text };
}

/**
 * Betreff, HTML und Text der Mail zum Zurücksetzen des Passworts.
 */
export function resetMailText(
  sprache: string,
  benutzername: string,
  link: string,
  gueltigMinuten: number,
): MailInhalt {
  const t = TEXTE[sprache] ?? TEXTE.en;
  const { html, text } = baueMail({
    sprache,
    anrede: t.anrede.replace('{name}', benutzername),
    einleitung: t.einleitung,
    knopf: t.knopf,
    link,
    hinweise: [t.gueltig.replace('{n}', String(gueltigMinuten)), t.ignorieren],
    fallback: t.fallback,
    abbinder: t.abbinder,
  });
  return { betreff: t.betreff, html, text };
}

/**
 * Betreff, HTML und Text der Mail zum Bestätigen der Adresse.
 *
 * Anrede, Fallback-Zeile und Abbinder kommen aus demselben Satz wie beim
 * Reset — die sind vom Anlass unabhängig und müssen nicht doppelt übersetzt
 * werden.
 */
export function verifyMailText(
  sprache: string,
  benutzername: string,
  link: string,
  gueltigTage: number,
): MailInhalt {
  const gemeinsam = TEXTE[sprache] ?? TEXTE.en;
  const v = VERIFY[sprache] ?? VERIFY.en;

  const { html, text } = baueMail({
    sprache,
    anrede: gemeinsam.anrede.replace('{name}', benutzername),
    einleitung: v.einleitung,
    knopf: v.knopf,
    link,
    hinweise: [v.gueltig.replace('{n}', String(gueltigTage)), v.warum],
    fallback: gemeinsam.fallback,
    abbinder: gemeinsam.abbinder,
  });
  return { betreff: v.betreff, html, text };
}
