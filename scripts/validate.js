import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'data');
const dbFile = path.join(dataDir, 'db.json');

async function testBackend() {
  console.log('=== TEST DU BACKEND REFACTORISÉ ===\n');

  try {
    // Test 1 : Authentification admin
    console.log('1. Test de connexion Admin...');
    const loginRes = await fetch('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login: 'admin', password: 'admin123' })
    });
    const loginData = await loginRes.json();
    if (!loginData.token) throw new Error('Échec connexion admin: ' + JSON.stringify(loginData));
    const token = loginData.token;
    console.log('✅ Connexion Admin réussie');

    // Test 2 : Spécialités (GET)
    console.log('\n2. Test récupération des spécialités...');
    const specRes = await fetch('http://localhost:3000/api/specialites', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const specs = await specRes.json();
    if (!Array.isArray(specs) || specs.length === 0) throw new Error('Aucune spécialité trouvée.');
    console.log(`✅ ${specs.length} spécialités récupérées (ex: ${specs[0].nom})`);

    // Test 3 : Spécialités (POST)
    console.log('\n3. Test ajout d\'une spécialité...');
    const newSpecName = 'Testologie ' + Math.floor(Math.random() * 1000);
    const postSpecRes = await fetch('http://localhost:3000/api/specialites', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      },
      body: JSON.stringify({ nom: newSpecName })
    });
    const newSpec = await postSpecRes.json();
    if (newSpec.nom !== newSpecName) throw new Error('Spécialité non créée: ' + JSON.stringify(newSpec));
    console.log(`✅ Spécialité "${newSpecName}" créée avec succès`);

    // Test 4 : Statistiques (Vérification refactoring)
    console.log('\n4. Test des statistiques globales (Refactoring)...');
    const statsRes = await fetch('http://localhost:3000/api/stats', {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const stats = await statsRes.json();
    if (stats.medecins === undefined) throw new Error('Statistiques invalides: ' + JSON.stringify(stats));
    console.log(`✅ Statistiques récupérées: ${stats.medecins} médecins, ${stats.assures} assurés`);

    console.log('\n=== TOUS LES TESTS SONT PASSÉS ✅ ===');
  } catch (error) {
    console.error('\n❌ ERREUR LORS DU TEST:', error.message);
    console.log('\nAssurez-vous que le serveur tourne avec "npm run dev" !');
  }
}

testBackend();
