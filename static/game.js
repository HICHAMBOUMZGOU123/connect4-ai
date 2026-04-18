/* ================================================
   ÉTAT GLOBAL
================================================ */

const ETAT = {
    plateau:        null,
    joueur_courant: 1,
    joueur_humain: 1,
    couleur_depart: 1,
    historique:     [],
    resultat:       null,
    lignes:         9,
    colonnes:       9,

    mode:           2,
    ia_rouge:       "minimax",
    ia_jaune:       "minimax",
    profondeur_rouge: 4,
    profondeur_jaune: 4,
    pion_editeur:   1,

    partie_sauvegardee: false,
    timer_ia:       null,
    delai_ia:       600,
    en_train:       false,

    replay_actif:   false,
    replay_coups:   [],
    replay_index:   0,

    redo_pile:      [],

    ia_lancee:      false,
};

const SEUIL_VICTOIRE = 500000;


document.addEventListener("DOMContentLoaded", async () => {
    const params = new URLSearchParams(window.location.search);
    const modeURL = params.get("mode");
    const startURL = params.get("start");
    const humainURL = params.get("humain");

    if (modeURL === "situation") {
        ETAT.mode = 3;
    } else if (modeURL === "0" || modeURL === "1" || modeURL === "2") {
        ETAT.mode = parseInt(modeURL);
    }

    if (startURL === "1" || startURL === "2") {
        ETAT.couleur_depart = parseInt(startURL);
    }

    if (humainURL === "1" || humainURL === "2") {
        ETAT.joueur_humain = parseInt(humainURL);
    }

    await nouvellePartie();

    if (ETAT.mode === 1 && ETAT.joueur_humain !== ETAT.couleur_depart && !ETAT.resultat) {
        await pause(500);
        const info = document.getElementById("info");
        if (info) { info.innerHTML = "🧠 IA réfléchit..."; info.className = "info ia-thinking"; }
        await pause(300);
        await jouerIA();
    }
});


async function nouvellePartie() {
    stopperTimerIA();
    ETAT.en_train = false;
    ETAT.replay_actif = false;
    ETAT.ia_lancee = false;

    const ctrl = document.getElementById("replayControls");
    if (ctrl) ctrl.remove();

    const res  = await fetch("/api/nouvelle", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
            lignes:         ETAT.lignes,
            colonnes:       ETAT.colonnes,
            couleur_depart: ETAT.couleur_depart,
        })
    });
    const data = await res.json();

    ETAT.plateau        = data.plateau;
    ETAT.joueur_courant = data.joueur_courant;
    ETAT.historique     = data.historique;
    ETAT.resultat       = null;
    ETAT.partie_sauvegardee = false;

    cacherConseil();
    mettreAJourUI();
}


function mettreAJourUI() {
    const btnMode2 = document.getElementById("btnMode2");
    const btnMode1 = document.getElementById("btnMode1");
    const btnMode0 = document.getElementById("btnMode0");
    if (btnMode2) btnMode2.classList.toggle("actif", ETAT.mode === 2);
    if (btnMode1) btnMode1.classList.toggle("actif", ETAT.mode === 1);
    if (btnMode0) btnMode0.classList.toggle("actif", ETAT.mode === 0);

    const modeSwitcher = document.querySelector(".mode-switcher");
    if (modeSwitcher) modeSwitcher.style.display = "flex";

    const undoRedoRow = document.getElementById("undoRedoRow");
    if (undoRedoRow) undoRedoRow.style.display = ETAT.mode === 3 ? "none" : "flex";

    const btnSituation = document.getElementById("btnSituation");
    if (btnSituation) btnSituation.classList.toggle("actif", ETAT.mode === 3);

    const zoneIA = document.getElementById("zoneIA");
    if (zoneIA) zoneIA.style.display = (ETAT.mode === 0 || ETAT.mode === 1) ? "block" : "none";

    const zoneSituation = document.getElementById("zoneSituation");
    if (zoneSituation) zoneSituation.style.display = ETAT.mode === 3 ? "block" : "none";

    if (ETAT.mode !== 3) {
        const zoneResultat = document.getElementById("resultatAnalyse");
        const zoneContainer = document.getElementById("zoneAnalyseResultat");
        if (zoneResultat) zoneResultat.innerHTML = "";
        if (zoneContainer) zoneContainer.style.display = "none";
    }

    const profRouge = document.getElementById("profondeurRouge");
    const profJaune = document.getElementById("profondeurJaune");
    if (profRouge) profRouge.value = String(ETAT.profondeur_rouge);
    if (profJaune) profJaune.value = String(ETAT.profondeur_jaune);

    const departSelect = document.getElementById("departSelect");
    if (departSelect) departSelect.value = String(ETAT.couleur_depart);

    mettreAJourBoutonsPion(ETAT.pion_editeur);

    if (ETAT.mode === 3) {
        afficherPlateauEditeur(ETAT.plateau);
    } else {
        afficherPlateau(ETAT.plateau);
    }

    const info = document.getElementById("info");
    if (info) {
        if (ETAT.resultat) {
            const emoji = ETAT.resultat === "rouge" ? "🔴" : ETAT.resultat === "jaune" ? "🟡" : "🤝";
            const texte = ETAT.resultat === "nul" ? "Match nul !" : `${emoji} ${ETAT.resultat.toUpperCase()} gagne !`;
            info.innerHTML = "🏆 " + texte;
            info.className = "info fin";
        } else if (ETAT.mode === 3) {
            info.innerHTML = "🧠 Mode Situation — placez vos pions librement";
            info.className = "info";
        } else {
            const emoji = ETAT.joueur_courant === 1 ? "🔴" : "🟡";
            const nom   = ETAT.joueur_courant === 1 ? "Rouge" : "Jaune";
            info.innerHTML = `${emoji} Tour de ${nom}`;
            info.className = "info";
        }
    }

    const btnPred = document.getElementById("btnPrediction");
    if (btnPred) {
        btnPred.style.display = (!ETAT.resultat && ETAT.mode !== 3) ? "inline-block" : "none";
    }

    const btnAnalyse = document.getElementById("btnAnalyser");
    if (btnAnalyse) {
        btnAnalyse.style.display = (!ETAT.resultat && ETAT.mode !== 3) ? "inline-block" : "none";
    }

    const btnLancerIA = document.getElementById("btnLancerIA");
    if (ETAT.mode === 0 && !ETAT.resultat) {
        if (btnLancerIA) btnLancerIA.style.display = ETAT.ia_lancee ? "none" : "inline-block";
        if (ETAT.ia_lancee) {
            demarrerTimerIA();
        } else {
            stopperTimerIA();
        }
    } else {
        if (btnLancerIA) btnLancerIA.style.display = "none";
        stopperTimerIA();
        ETAT.en_train = false;
    }

    if (ETAT.resultat && !ETAT.partie_sauvegardee) {
        sauvegarderPartie();
    }
}


function afficherPlateau(plateau) {
    if (!plateau) return;
    const plateauDiv = document.getElementById("plateau");
    plateauDiv.innerHTML = "";

    const nbCol = plateau[0].length;
    plateauDiv.style.gridTemplateColumns = `repeat(${nbCol}, 50px)`;

    const cliquable = ETAT.mode !== 0 && !ETAT.resultat && ETAT.mode !== 3;

    plateau.forEach((ligne, rowIndex) => {
        ligne.forEach((cell, colIndex) => {
            const div = document.createElement("div");
            div.className = "case";
            if (cell === 1) div.classList.add("rouge");
            if (cell === 2) div.classList.add("jaune");

            if (cliquable) {
                div.onclick = () => jouer(colIndex);
                div.style.cursor = "pointer";
            }
            plateauDiv.appendChild(div);
        });
    });
}


function afficherPlateauEditeur(plateau) {
    if (!plateau) return;
    const plateauDiv = document.getElementById("plateau");
    plateauDiv.innerHTML = "";

    const nbCol = plateau[0].length;
    plateauDiv.style.gridTemplateColumns = `repeat(${nbCol}, 50px)`;

    plateau.forEach((ligne, rowIndex) => {
        ligne.forEach((cell, colIndex) => {
            const div = document.createElement("div");
            div.className = "case editeur";
            if (cell === 1) div.classList.add("rouge");
            if (cell === 2) div.classList.add("jaune");
            div.style.cursor = "pointer";
            div.onclick = () => situationPlacer(rowIndex, colIndex);
            plateauDiv.appendChild(div);
        });
    });
}


async function jouer(col) {
    if (ETAT.en_train || ETAT.resultat || ETAT.mode === 0 || ETAT.mode === 3) return;

    ETAT.en_train = true;
    ETAT.redo_pile = [];
    desactiverPlateau();
    cacherConseil();

    const res  = await fetch("/api/jouer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...getEtatServeur(), col })
    });
    const data = await res.json();

    if (data.status === "col_invalide" || data.status === "fin") {
        ETAT.en_train = false;
        activerPlateau();
        return;
    }

    ETAT.plateau        = data.plateau;
    ETAT.joueur_courant = data.joueur_courant;
    ETAT.historique     = data.historique;
    ETAT.resultat       = data.resultat;

    mettreAJourUI();

    if (!ETAT.resultat && ETAT.mode === 1) {
        const info = document.getElementById("info");
        if (info) { info.innerHTML = "🧠 IA réfléchit..."; info.className = "info ia-thinking"; }

        await pause(300);
        await jouerIA();
    }

    ETAT.en_train = false;
    activerPlateau();
}


async function jouerIA() {
    if (ETAT.resultat) return;

    const joueur    = ETAT.joueur_courant;
    const ia_type   = joueur === 1 ? ETAT.ia_rouge : ETAT.ia_jaune;
    const profondeur = joueur === 1 ? ETAT.profondeur_rouge : ETAT.profondeur_jaune;

    const res  = await fetch("/api/ia_step", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...getEtatServeur(), ia_type, profondeur })
    });
    const data = await res.json();

    if (data.status === "fin" || data.status === "nul") return;

    ETAT.plateau        = data.plateau;
    ETAT.joueur_courant = data.joueur_courant;
    ETAT.historique     = data.historique;
    ETAT.resultat       = data.resultat;

    mettreAJourUI();
}


function demarrerTimerIA() {
    if (ETAT.timer_ia !== null) return;

    ETAT.timer_ia = setInterval(async () => {
        if (ETAT.en_train || ETAT.resultat) return;
        ETAT.en_train = true;

        const info = document.getElementById("info");
        if (info) info.innerHTML = "🤖 IA joue...";

        await jouerIA();

        ETAT.en_train = false;
        if (ETAT.resultat) stopperTimerIA();
    }, ETAT.delai_ia);
}

function stopperTimerIA() {
    if (ETAT.timer_ia !== null) {
        clearInterval(ETAT.timer_ia);
        ETAT.timer_ia = null;
    }
}


async function annulerCoup() {
    if (ETAT.en_train) return;
    if (ETAT.mode === 3) return;
    if (!ETAT.historique || ETAT.historique.length === 0) return;

    stopperTimerIA();
    ETAT.en_train = false;
    cacherConseil();

    const dernierCoup = ETAT.historique[ETAT.historique.length - 1];
    ETAT.redo_pile.push(dernierCoup);

    const res = await fetch("/api/annuler", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify(getEtatServeur())
    });
    const data = await res.json();

    ETAT.plateau        = data.plateau;
    ETAT.joueur_courant = data.joueur_courant;
    ETAT.historique     = data.historique;
    ETAT.resultat       = data.resultat;

    mettreAJourUI();
}

async function refaireCoup() {
    if (ETAT.en_train) return;
    if (ETAT.mode === 3) return;
    if (!ETAT.redo_pile || ETAT.redo_pile.length === 0) return;
    if (ETAT.resultat) return;

    stopperTimerIA();
    cacherConseil();

    const coup = ETAT.redo_pile.pop();
    const col = coup[1];

    const res = await fetch("/api/jouer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...getEtatServeur(), col })
    });
    const data = await res.json();

    if (data.status === "ok") {
        ETAT.plateau        = data.plateau;
        ETAT.joueur_courant = data.joueur_courant;
        ETAT.historique     = data.historique;
        ETAT.resultat       = data.resultat;
    }

    mettreAJourUI();
}


async function switcherMode(mode) {
    if (isNaN(mode)) return;

    const venaitDeSituation = (ETAT.mode === 3);

    if (mode === ETAT.mode && !venaitDeSituation) return;

    stopperTimerIA();
    ETAT.en_train = false;
    ETAT.mode     = mode;
    ETAT.ia_lancee = false;
    ETAT.resultat = null;
    cacherConseil();

    if (venaitDeSituation) {
        const joueurSelect = document.getElementById("joueurAnalyse");
        const joueur = joueurSelect ? parseInt(joueurSelect.value) : 1;

        ETAT.joueur_courant = joueur;
        ETAT.partie_sauvegardee = false;
        ETAT.historique = [];

        if (mode === 1) {
            ETAT.joueur_humain = joueur;
        }

        mettreAJourUI();

        const nomMode = mode === 0 ? "IA vs IA" : mode === 1 ? "Humain vs IA" : "2 Joueurs";
        const emoji = joueur === 1 ? "🔴" : "🟡";
        const nomJoueur = joueur === 1 ? "Rouge" : "Jaune";

        const info = document.getElementById("info");
        if (info) {
            info.innerHTML = `▶ Partie lancée en ${nomMode} — ${emoji} ${nomJoueur} commence`;
            info.className = "info";
        }
    } else {
        mettreAJourUI();
    }
}

function lancerIAvIA() {
    ETAT.ia_lancee = true;
    mettreAJourUI();
}

async function activerSituation() {
    stopperTimerIA();
    ETAT.en_train = false;
    cacherConseil();

    ETAT.mode = ETAT.mode === 3 ? 2 : 3;

    mettreAJourUI();
}


async function changerDepart() {
    const couleur = parseInt(document.getElementById("departSelect").value);
    ETAT.couleur_depart = couleur;
    ETAT.joueur_humain = couleur;

    const estVide = ETAT.plateau.every(row => row.every(cell => cell === 0));
    if (estVide) {
        await nouvellePartie();
    } else {
        ETAT.joueur_courant = couleur;
        mettreAJourUI();
    }
}


async function changerProfondeur(joueur) {
    const id   = joueur === "rouge" ? "profondeurRouge" : "profondeurJaune";
    const prof = parseInt(document.getElementById(id).value);
    if (joueur === "rouge") ETAT.profondeur_rouge = prof;
    else ETAT.profondeur_jaune = prof;
}

async function changerStrategie() {
    ETAT.ia_rouge = document.getElementById("strategieRouge").value;
    ETAT.ia_jaune = document.getElementById("strategieJaune").value;
}

function appliquerDelaiIA() {
    ETAT.delai_ia = parseInt(document.getElementById("delaiIA").value) || 600;
    stopperTimerIA();
    if (ETAT.mode === 0 && !ETAT.resultat) demarrerTimerIA();
}


function chargerDepuisFichier() {
    const input = document.getElementById("chargerFichier");
    if (!input.files || input.files.length === 0) return;

    const fichier = input.files[0];
    const nomFichier = fichier.name.replace(/\.[^.]+$/, "");
    const coups = nomFichier.replace(/[^0-9]/g, "");

    if (coups.length === 0) {
        const info = document.getElementById("info");
        if (info) { info.innerHTML = "❌ Pas de chiffres dans le nom du fichier"; info.className = "info"; }
        input.value = "";
        return;
    }

    const lignes = ETAT.lignes;
    const colonnes = ETAT.colonnes;
    let plateau = Array.from({ length: lignes }, () => new Array(colonnes).fill(0));
    let joueur = ETAT.couleur_depart || 1;
    let nbCoups = 0;
    let historique = [];

    for (const ch of coups) {
        const col = parseInt(ch) - 1;
        if (col < 0 || col >= colonnes) continue;

        let placed = false;
        for (let row = lignes - 1; row >= 0; row--) {
            if (plateau[row][col] === 0) {
                plateau[row][col] = joueur;
                historique.push([row, col, joueur]);
                placed = true;
                break;
            }
        }
        if (placed) {
            nbCoups++;
            joueur = joueur === 1 ? 2 : 1;
        }
    }

    ETAT.plateau = plateau;
    ETAT.joueur_courant = joueur;
    ETAT.resultat = null;
    ETAT.historique = historique;
    ETAT.partie_sauvegardee = false;

    const nomJoueur = joueur === 1 ? "Rouge" : "Jaune";
    const emoji = joueur === 1 ? "🔴" : "🟡";

    const info = document.getElementById("info");
    if (info) {
        info.innerHTML = `📂 "${fichier.name}" chargé (${nbCoups} coups) — ${emoji} ${nomJoueur} joue`;
        info.className = "info";
    }

    const joueurSelect = document.getElementById("joueurAnalyse");
    if (joueurSelect) joueurSelect.value = String(joueur);

    input.value = "";
    mettreAJourUI();
}


async function importerSequence() {
    const input = document.getElementById("importFichier");
    const infoDiv = document.getElementById("importInfo");

    if (!input.files || input.files.length === 0) return;

    const fichier = input.files[0];

    const nomFichier = fichier.name.replace(/\.[^.]+$/, "");
    const coups = nomFichier.replace(/[^0-9]/g, "");

    if (coups.length === 0) {
        if (infoDiv) infoDiv.innerHTML = "❌ Pas de chiffres dans le nom du fichier";
        return;
    }

    const lignes = ETAT.lignes;
    const colonnes = ETAT.colonnes;
    let plateau = Array.from({ length: lignes }, () => new Array(colonnes).fill(0));
    let joueur = ETAT.couleur_depart || 1;
    let nbCoups = 0;
    let historique = [];

    for (const ch of coups) {
        const col = parseInt(ch) - 1;
        if (col < 0 || col >= colonnes) continue;

        let placed = false;
        for (let row = lignes - 1; row >= 0; row--) {
            if (plateau[row][col] === 0) {
                plateau[row][col] = joueur;
                historique.push([row, col, joueur]);
                placed = true;
                break;
            }
        }

        if (placed) {
            nbCoups++;
            joueur = joueur === 1 ? 2 : 1;
        }
    }

    ETAT.plateau = plateau;
    ETAT.joueur_courant = joueur;
    ETAT.resultat = null;
    ETAT.historique = historique;

    afficherPlateauEditeur(ETAT.plateau);

    const joueurSelect = document.getElementById("joueurAnalyse");
    if (joueurSelect) joueurSelect.value = String(joueur);

    const nomJoueur = joueur === 1 ? "Rouge" : "Jaune";
    const emoji = joueur === 1 ? "🔴" : "🟡";
    if (infoDiv) {
        infoDiv.innerHTML = `✅ ${nbCoups} coups chargés depuis "${fichier.name}" — ${emoji} ${nomJoueur} joue`;
    }

    const info = document.getElementById("info");
    if (info) {
        info.innerHTML = `📂 Séquence "${nomFichier}" (${nbCoups} coups) — ${emoji} ${nomJoueur} joue`;
        info.className = "info";
    }

    input.value = "";
}

async function situationPlacer(lig, col) {
    let couleur = ETAT.pion_editeur;
    if (ETAT.plateau[lig][col] === couleur) couleur = 0;

    const res  = await fetch("/api/situation/placer", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...getEtatServeur(), lig, col, couleur })
    });
    const data = await res.json();

    ETAT.plateau = data.plateau;
    afficherPlateauEditeur(ETAT.plateau);

    const info = document.getElementById("info");
    if (data.victoire_rouge) {
        info.innerHTML = "🔴 Rouge est déjà gagnant !";
        info.className = "info fin";
    } else if (data.victoire_jaune) {
        info.innerHTML = "🟡 Jaune est déjà gagnant !";
        info.className = "info fin";
    } else {
        info.innerHTML = "🧠 Mode Situation — placez vos pions librement";
        info.className = "info";
    }
}

async function changerPionEditeur(pion) {
    ETAT.pion_editeur = pion;
    mettreAJourBoutonsPion(pion);
}

function mettreAJourBoutonsPion(pion) {
    const btnRouge   = document.getElementById("btnPionRouge");
    const btnJaune   = document.getElementById("btnPionJaune");
    if (btnRouge)   btnRouge.classList.toggle("actif", pion === 1);
    if (btnJaune)   btnJaune.classList.toggle("actif", pion === 2);
}

async function continuerPartie(mode) {
    const joueurSelect = document.getElementById("joueurAnalyse");
    const joueur = joueurSelect ? parseInt(joueurSelect.value) : ETAT.joueur_courant;

    ETAT.joueur_courant = joueur;
    ETAT.mode = mode;
    ETAT.resultat = null;
    ETAT.en_train = false;
    ETAT.partie_sauvegardee = false;

    ETAT.historique = [];

    if (mode === 1) {
        ETAT.joueur_humain = joueur;
    }

    cacherConseil();
    mettreAJourUI();

    const nomMode = mode === 0 ? "IA vs IA" : mode === 1 ? "Humain vs IA" : "2 Joueurs";
    const emoji = joueur === 1 ? "🔴" : "🟡";
    const nomJoueur = joueur === 1 ? "Rouge" : "Jaune";

    const info = document.getElementById("info");
    if (info) {
        info.innerHTML = `▶ Partie lancée en ${nomMode} — ${emoji} ${nomJoueur} commence`;
        info.className = "info";
    }
}

async function situationEffacer() {
    ETAT.plateau = Array.from({ length: ETAT.lignes }, () => new Array(ETAT.colonnes).fill(0));
    ETAT.resultat = null;
    ETAT.mode = 3;

    afficherPlateauEditeur(ETAT.plateau);

    const info = document.getElementById("info");
    info.innerHTML = "🧠 Mode Situation — plateau effacé";
    info.className = "info";

    const zoneResultat = document.getElementById("resultatAnalyse");
    const zoneContainer = document.getElementById("zoneAnalyseResultat");
    if (zoneResultat) zoneResultat.innerHTML = "";
    if (zoneContainer) zoneContainer.style.display = "none";

    const fi = document.getElementById("importFichier");
    if (fi) fi.value = "";
    const ii = document.getElementById("importInfo");
    if (ii) ii.innerHTML = "";
}

async function situationAnalyser() {
    const joueurSelect = document.getElementById("joueurAnalyse");
    const joueur_analyse = joueurSelect ? parseInt(joueurSelect.value) : 1;

    const profSelect = document.getElementById("profondeurAnalyse");
    const profondeur = profSelect ? parseInt(profSelect.value) : 6;

    const info = document.getElementById("info");
    info.innerHTML = "🔍 Analyse en cours...";
    info.className = "info ia-thinking";

    const res  = await fetch("/api/situation/analyser", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...getEtatServeur(), joueur_analyse, profondeur })
    });
    const data = await res.json();

    info.innerHTML = "🧠 Mode Situation — placez vos pions librement";
    info.className = "info";

    const zoneResultat  = document.getElementById("resultatAnalyse");
    const zoneContainer = document.getElementById("zoneAnalyseResultat");

    if (zoneResultat) {
        let couleurResultat = "#facc15";
        if (data.gagnant === "rouge")     couleurResultat = "#ef4444";
        if (data.gagnant === "jaune")     couleurResultat = "#facc15";
        if (data.gagnant === "equilibre") couleurResultat = "#60a5fa";

        zoneResultat.innerHTML = `
            <div class="analyse-result" style="border-color: ${couleurResultat}">
                <p style="font-size:18px; font-weight:bold;">${data.message}</p>
                ${data.meilleur_col !== undefined
                    ? `<p class="meilleur-coup">🎯 Meilleur coup : colonne <strong>${data.meilleur_col + 1}</strong></p>`
                    : ""}
                ${data.nb_coups !== undefined && data.nb_coups !== null
                    ? `<p>📊 Victoire forcée en <strong>${data.nb_coups} coup(s)</strong></p>`
                    : ""}
            </div>
        `;
        if (zoneContainer) zoneContainer.style.display = "block";
    }

    if (data.meilleur_col !== undefined) surlignerColonne(data.meilleur_col);
}

async function changerProfondeurAnalyse() {}


async function analyserDepuisJeu() {
    if (ETAT.resultat) return;

    return new Promise((resolve) => {
        const overlay = document.createElement("div");
        overlay.id = "modalProfondeur";
        overlay.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.85);z-index:2000;display:flex;align-items:center;justify-content:center;";

        overlay.innerHTML = `
            <div style="background:linear-gradient(160deg,#020617,#0f172a);padding:30px 40px;border-radius:20px;box-shadow:0 30px 60px rgba(0,0,0,0.9);text-align:center;min-width:320px;">
                <h3 style="margin:0 0 20px 0;font-size:20px;">🔍 Profondeur d'analyse</h3>
                <div style="display:flex;align-items:center;gap:15px;justify-content:center;margin-bottom:20px;">
                    <input type="range" id="sliderProfondeur" min="4" max="14" step="2" value="10"
                        style="width:200px;accent-color:#3b82f6;cursor:pointer;"
                        oninput="document.getElementById('valProfondeur').textContent=this.value">
                    <span id="valProfondeur" style="font-size:28px;font-weight:bold;color:#3b82f6;min-width:35px;">10</span>
                </div>
                <div style="display:flex;justify-content:space-between;padding:0 10px;margin-bottom:20px;font-size:11px;opacity:0.5;">
                    <span>Rapide</span>
                    <span>Précis</span>
                    <span>Profond</span>
                </div>
                <div style="display:flex;gap:10px;justify-content:center;">
                    <button id="btnLancerAnalyse" style="padding:12px 30px;border-radius:10px;background:linear-gradient(145deg,#3b82f6,#2563eb);color:white;font-weight:bold;border:none;cursor:pointer;font-size:15px;">
                        🔍 Analyser
                    </button>
                    <button id="btnAnnulerAnalyse" style="padding:12px 20px;border-radius:10px;background:#1e293b;color:white;border:none;cursor:pointer;font-size:15px;">
                        Annuler
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        document.getElementById("btnAnnulerAnalyse").onclick = () => {
            overlay.remove();
            resolve();
        };

        overlay.onclick = (e) => {
            if (e.target === overlay) { overlay.remove(); resolve(); }
        };

        document.getElementById("btnLancerAnalyse").onclick = async () => {
            const profondeurMax = parseInt(document.getElementById("sliderProfondeur").value);
            overlay.remove();

            const joueur_analyse = ETAT.joueur_courant;
            const info = document.getElementById("info");

            const barreDiv = document.createElement("div");
            barreDiv.id = "barreProgression";
            barreDiv.style.cssText = "width:80%;max-width:500px;margin:10px auto;text-align:center;";
            barreDiv.innerHTML = `
                <div style="background:#1e293b;border-radius:12px;overflow:hidden;height:28px;position:relative;box-shadow:inset 0 2px 6px rgba(0,0,0,0.5);">
                    <div id="barreFill" style="height:100%;width:0%;background:linear-gradient(90deg,#3b82f6,#22c55e);border-radius:12px;transition:width 0.3s ease;"></div>
                    <span id="barreTexte" style="position:absolute;top:0;left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:bold;color:white;text-shadow:0 1px 3px rgba(0,0,0,0.5);">0%</span>
                </div>
                <p id="barreDetail" style="font-size:12px;opacity:0.7;margin-top:6px;">Préparation...</p>
            `;

            const plateauDiv = document.getElementById("plateau");
            plateauDiv.parentNode.insertBefore(barreDiv, plateauDiv);

            if (info) {
                info.innerHTML = "🔍 Analyse en cours...";
                info.className = "info ia-thinking";
            }

            const etapes = [];
            for (let d = 2; d <= profondeurMax; d += 2) etapes.push(d);
            if (etapes.length === 0) etapes.push(profondeurMax);

            let dernierResultat = null;

            for (let i = 0; i < etapes.length; i++) {
                const d = etapes[i];
                const pct = Math.round(((i + 1) / etapes.length) * 100);

                const barreDetail = document.getElementById("barreDetail");
                if (barreDetail) barreDetail.textContent = `Profondeur ${d}/${profondeurMax}...`;

                const res = await fetch("/api/situation/analyser", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ ...getEtatServeur(), joueur_analyse, profondeur: d })
                });
                dernierResultat = await res.json();

                const barreFill = document.getElementById("barreFill");
                const barreTexte = document.getElementById("barreTexte");
                if (barreFill) barreFill.style.width = pct + "%";
                if (barreTexte) barreTexte.textContent = pct + "%";

                if (dernierResultat.nb_coups !== undefined && dernierResultat.nb_coups !== null) {
                    if (barreFill) barreFill.style.width = "100%";
                    if (barreTexte) barreTexte.textContent = "100% — Victoire trouvée !";
                    if (barreFill) barreFill.style.background = "linear-gradient(90deg,#22c55e,#16a34a)";
                    break;
                }
            }

            await pause(500);

            const barre = document.getElementById("barreProgression");
            if (barre) barre.remove();

            const data = dernierResultat;

            const emoji = ETAT.joueur_courant === 1 ? "🔴" : "🟡";
            const nom = ETAT.joueur_courant === 1 ? "Rouge" : "Jaune";
            if (info) {
                info.innerHTML = `${emoji} Tour de ${nom}`;
                info.className = "info";
            }

            const zoneResultat = document.getElementById("resultatAnalyse");
            const zoneContainer = document.getElementById("zoneAnalyseResultat");

            if (zoneResultat) {
                let couleurResultat = "#facc15";
                if (data.gagnant === "rouge") couleurResultat = "#ef4444";
                if (data.gagnant === "jaune") couleurResultat = "#facc15";
                if (data.gagnant === "equilibre") couleurResultat = "#60a5fa";

                zoneResultat.innerHTML = `
                    <div class="analyse-result" style="border-color: ${couleurResultat}">
                        <p style="font-size:18px; font-weight:bold;">${data.message}</p>
                        ${data.meilleur_col !== undefined
                            ? `<p class="meilleur-coup">🎯 Meilleur coup : colonne <strong>${data.meilleur_col + 1}</strong></p>`
                            : ""}
                        ${data.nb_coups !== undefined && data.nb_coups !== null
                            ? `<p>📊 Victoire forcée en <strong>${data.nb_coups} coup(s)</strong></p>`
                            : ""}
                    </div>
                `;
                if (zoneContainer) zoneContainer.style.display = "block";
            }

            if (data.meilleur_col !== undefined) surlignerColonne(data.meilleur_col);

            resolve();
        };
    });
}


async function afficherConseil() {
    const res  = await fetch("/api/conseil", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...getEtatServeur(), profondeur: 4 })
    });
    const data = await res.json();

    if (data.status !== "ok") return;
    afficherScoresColonnes(data.scores, data.meilleur_col);
}

function afficherScoresColonnes(scores, meilleurCol) {
    cacherConseil();

    const plateauDiv = document.getElementById("plateau");
    if (!plateauDiv) return;

    const nbCol = ETAT.colonnes;
    const cases = plateauDiv.querySelectorAll(".case");
    if (cases.length === 0) return;

    plateauDiv.style.position = "relative";

    for (let col = 0; col < nbCol; col++) {
        const caseTarget = cases[col];
        if (!caseTarget) continue;

        const rect        = caseTarget.getBoundingClientRect();
        const plateauRect = plateauDiv.getBoundingClientRect();
        const scoreCol    = scores[col];
        const isMeilleur  = col === meilleurCol;

        let couleur = "#60a5fa";
        if (scoreCol === undefined)              couleur = "#475569";
        else if (scoreCol > SEUIL_VICTOIRE)      couleur = "#22c55e";
        else if (scoreCol < -SEUIL_VICTOIRE)     couleur = "#ef4444";
        else if (scoreCol > 500)                 couleur = "#86efac";
        else if (scoreCol < -500)                couleur = "#fca5a5";

        let texteScore;
        if (scoreCol === undefined) {
            texteScore = "X";
        } else if (scoreCol > SEUIL_VICTOIRE) {
            const demi = 1000000 - scoreCol;
            const coups = Math.ceil((demi + 1) / 2);
            texteScore = `WIN ${coups}`;
        } else if (scoreCol < -SEUIL_VICTOIRE) {
            const demi = 1000000 + scoreCol;
            const coups = Math.ceil((demi + 1) / 2);
            texteScore = `LOSE ${coups}`;
        } else {
            texteScore = (scoreCol > 0 ? "+" : "") + scoreCol;
        }

        const div = document.createElement("div");
        div.className = "conseil-score-col";

        div.innerHTML = `
            <div style="text-align:center; color:${couleur}; font-size:${isMeilleur ? "13px" : "11px"}; font-weight:${isMeilleur ? "bold" : "normal"}; opacity:${isMeilleur ? "1" : "0.75"};">
                ${isMeilleur ? `<div style="font-size:22px; animation: bounceDown 0.8s infinite;">▼</div>` : ""}
                <div>${texteScore}</div>
            </div>
        `;

        div.style.position    = "absolute";
        div.style.left        = (rect.left - plateauRect.left + rect.width/2 - 20) + "px";
        div.style.top         = isMeilleur ? "-70px" : "-35px";
        div.style.width       = "40px";
        div.style.zIndex      = "100";
        div.style.pointerEvents = "none";

        plateauDiv.appendChild(div);
    }
}

function cacherConseil() {
    document.querySelectorAll(".conseil-score-col").forEach(e => e.remove());
    const fleche = document.getElementById("conseilFleche");
    if (fleche) fleche.remove();
}


function surlignerColonne(col) {
    const cases = document.querySelectorAll(".case");
    const nbCol = ETAT.colonnes;

    cases.forEach((c, index) => {
        c.classList.remove("surligne");
        if (index % nbCol === col) c.classList.add("surligne");
    });

    setTimeout(() => {
        document.querySelectorAll(".case.surligne").forEach(c => c.classList.remove("surligne"));
    }, 3000);
}


async function sauvegarderPartie() {
    if (ETAT.partie_sauvegardee) return;

    await fetch("/api/sauvegarder", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ ...getEtatServeur(), mode: ETAT.mode })
    });

    ETAT.partie_sauvegardee = true;
}


async function ouvrirHistorique() {
    document.getElementById("modalHistorique").style.display = "block";
    const res  = await fetch("/api/historique");
    const data = await res.json();

    const liste = document.getElementById("listeParties");
    liste.innerHTML = "";

    data.forEach(partie => {
        const tr = document.createElement("tr");
        const couleur = partie.resultat === "rouge"
            ? "style='color:#ef4444;font-weight:bold'"
            : "style='color:#facc15;font-weight:bold'";

        tr.innerHTML = `
            <td>${partie.id}</td>
            <td>${partie.date}</td>
            <td style="font-family:monospace">${partie.coups}</td>
            <td ${couleur}>${partie.resultat}</td>
            <td>${partie.statut}</td>
            <td><button onclick="chargerPartie(${partie.id},'${partie.coups}')">▶ Replay</button></td>
        `;
        liste.appendChild(tr);
    });
}

function fermerHistorique() {
    document.getElementById("modalHistorique").style.display = "none";
}


async function chargerPartie(id, coups) {
    fermerHistorique();

    const res  = await fetch(`/api/charger/${id}`);
    const data = await res.json();

    if (data.status !== "ok") return;

    ETAT.plateau        = data.plateau;
    ETAT.joueur_courant = data.joueur_courant;
    ETAT.couleur_depart = data.couleur_depart;
    ETAT.historique     = data.historique;
    ETAT.resultat       = data.resultat;
    ETAT.lignes         = data.lignes;
    ETAT.colonnes       = data.colonnes;
    ETAT.partie_sauvegardee = true;

    ETAT.replay_actif  = true;
    ETAT.replay_coups  = coups.split("").map(Number);
    ETAT.replay_index  = ETAT.replay_coups.length;

    afficherReplay();
    afficherControlesReplay();
}


function afficherReplay() {
    const lignes   = ETAT.lignes;
    const colonnes = ETAT.colonnes;
    let plateau = Array.from({ length: lignes }, () => new Array(colonnes).fill(0));
    let joueur  = ETAT.couleur_depart || 1;

    for (let i = 0; i < ETAT.replay_index; i++) {
        const col = ETAT.replay_coups[i] - 1;
        for (let row = lignes - 1; row >= 0; row--) {
            if (plateau[row][col] === 0) {
                plateau[row][col] = joueur;
                break;
            }
        }
        joueur = joueur === 1 ? 2 : 1;
    }

    afficherPlateau(plateau);

    const info = document.getElementById("info");
    if (info) info.innerHTML = `🎬 Replay — coup ${ETAT.replay_index} / ${ETAT.replay_coups.length}`;
}

function afficherControlesReplay() {
    let div = document.getElementById("replayControls");
    if (!div) {
        div = document.createElement("div");
        div.id = "replayControls";
        div.innerHTML = `
            <button onclick="replayPrecedent()">◀ Précédent</button>
            <button onclick="replaySuivant()">Suivant ▶</button>
            <button onclick="quitterReplay()">✕ Quitter</button>
        `;
        document.getElementById("plateau").after(div);
    }
}

function replaySuivant() {
    if (ETAT.replay_index < ETAT.replay_coups.length) { ETAT.replay_index++; afficherReplay(); }
}

function replayPrecedent() {
    if (ETAT.replay_index > 0) { ETAT.replay_index--; afficherReplay(); }
}

function quitterReplay() {
    ETAT.replay_actif = false;
    const ctrl = document.getElementById("replayControls");
    if (ctrl) ctrl.remove();
    mettreAJourUI();
}


function getEtatServeur() {
    return {
        plateau:        ETAT.plateau,
        joueur_courant: ETAT.joueur_courant,
        couleur_depart: ETAT.couleur_depart,
        historique:     ETAT.historique,
        resultat:       ETAT.resultat,
        lignes:         ETAT.lignes,
        colonnes:       ETAT.colonnes,
    };
}


function pause(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function desactiverPlateau() {
    document.querySelectorAll(".case").forEach(c => {
        c.style.pointerEvents = "none";
        c.style.opacity = "0.6";
    });
}

function activerPlateau() {
    document.querySelectorAll(".case").forEach(c => {
        c.style.pointerEvents = "auto";
        c.style.opacity = "1";
    });
}

window.onclick = function(event) {
    const modal = document.getElementById("modalHistorique");
    if (event.target === modal) modal.style.display = "none";
}