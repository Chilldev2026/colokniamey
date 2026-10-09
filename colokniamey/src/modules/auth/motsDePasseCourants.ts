// RGP26 : la détection des mots de passe divulgués de Supabase est réservée à l'offre Pro.
// On refuse donc, côté formulaire, une liste intégrée de mots de passe très courants
// (les plus utilisés dans le monde et en français, plus quelques variantes liées à l'application).
// Le déclencheur SQL ne voit jamais le mot de passe en clair : il ne peut pas refaire ce contrôle.

const LISTE = [
  '12345678', '123456789', '1234567890', '123123123', '11111111', '00000000', '87654321', '12341234',
  '11223344', '12121212', '123456789a', 'a1234567', 'a12345678', 'abc12345', 'abcd1234', 'abcdefgh',
  'azerty123', 'azertyui', 'azertyuiop', 'azerty1234', 'azerty12', 'qwertyui', 'qwerty123', 'qwertyuiop',
  'qwerty12', 'qwerty1234', 'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd',
  'p@ssword', 'motdepasse', 'motdepasse1', 'motdepasse123', 'mot2passe', 'monmotdepasse', 'bonjour123',
  'bonjour1', 'bonjour12', 'soleil123', 'doudou123', 'chocolat', 'chocolat1', 'iloveyou', 'iloveyou1',
  'iloveyou2', 'letmein1', 'welcome1', 'welcome12', 'welcome123', 'admin123', 'admin1234', 'administrator',
  'root1234', 'test1234', 'testtest', 'changeme', 'changeme1', 'trustno1', 'sunshine', 'princess',
  'football', 'football1', 'baseball', 'master123', 'monkey123', 'dragon123', 'superman', 'batman123',
  'starwars', 'whatever', 'computer', 'internet', 'michael1', 'jennifer', 'jordan23', 'liverpool',
  'barcelona', 'realmadrid', 'psg12345', 'marseille', 'azerty', 'qwerty', 'motdepass', 'niamey123',
  'niamey2024', 'niamey2025', 'niamey2026', 'niger123', 'niger2024', 'niger2025', 'niger2026', 'niger227',
  'niamey227', 'colokniamey', 'colokniamey1', 'colokniamey123', 'coloc1234', 'colocation', 'colocation1',
  'etudiant', 'etudiant1', 'etudiant123', 'universite', 'universite1', 'uam12345', 'uam2025', 'uam2026',
  'abdou123', 'moumouni', 'moumouni1', 'bismillah', 'bismillah1', 'allahuakbar', 'alhamdulillah',
  'inshallah', 'mohamed123', 'mohammed1', 'ibrahim123', 'abdoulaye', 'abdoulaye1', 'aminata123',
  'issoufou', 'issoufou1', 'hamidou1', 'moussa123', 'oumarou1', 'zinder123', 'maradi123', 'tahoua123',
  'agadez123', 'dosso1234', 'tillaberi', 'diffa1234', 'abcabc123', 'aaaaaaaa', 'aaaa1111', 'zxcvbnm1',
  'zxcvbnm123', 'asdfghjk', 'asdfgh123', 'qazwsxedc', '1q2w3e4r', '1q2w3e4r5t', '1qaz2wsx', 'q1w2e3r4',
  'a1b2c3d4', 'a1b2c3d4e5', '1a2b3c4d', 'abc123456', '987654321', '9876543210', '0123456789', '01234567',
  '123qweasd', 'qweasdzxc', 'passpass', 'pass1234', 'pass12345', 'motdepasse2', 'secret123', 'secret12',
  'secretsecret', 'dieu12345', 'dieuestgrand', 'jesuisla', 'loveyou1', 'loveyou123', 'mylove123', 'bonheur1',
]

const MOTS_COURANTS = new Set(LISTE)

/** Vrai si le mot de passe figure dans la liste des mots de passe courants (casse ignorée). */
export function estMotDePasseCourant(motDePasse: string): boolean {
  return MOTS_COURANTS.has(motDePasse.toLowerCase())
}
