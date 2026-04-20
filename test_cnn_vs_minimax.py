# test_cnn_vs_minimax.py
# Compare CNN, MinimaxCNN et Minimax pur sur N parties

import time
import random
import os
from modele import Puissance4Modele
from ia_joueur import IAJoueurCNN, MinimaxCNN

# =========================================================
# CONFIGURATION
# =========================================================

PROFONDEUR_MINIMAX_PUR  = 4    # Adversaire Minimax classique
PROFONDEUR_MINIMAX_CNN  = 4    # Pour le mode hybride
NB_PARTIES_CNN_PUR      = 30   # CNN pur vs Minimax (rapide)
NB_PARTIES_HYBRIDE      = 10   # MinimaxCNN vs Minimax (plus lent)

CHEMIN_MODELE = "modele_ia_best.pt"


# =========================================================
# UTILITAIRES
# =========================================================

def afficher_plateau(plateau):
    """Affichage simple en console pour debug."""
    print()
    for ligne in plateau:
        print("  " + " ".join(
            "." if c == 0 else ("R" if c == 1 else "J") for c in ligne
        ))
    print("  " + " ".join(str(i+1) for i in range(len(plateau[0]))))
    print()


def jouer_partie(joueur1_fn, joueur2_fn, modele, qui_commence=1, verbose=False):
    """
    joueur1_fn et joueur2_fn sont des fonctions qui prennent (modele) et retournent une colonne.
    qui_commence : 1 (Rouge) ou 2 (Jaune)
    Retourne : 1 (joueur1 gagne), 2 (joueur2 gagne), 0 (nul)
    """
    modele.nouvelle_partie()
    modele.joueur_courant = qui_commence
    modele.couleur_depart = qui_commence

    coups = 0
    while True:
        coups += 1
        if coups > 81:  # max plateau 9x9
            return 0

        # Tour du joueur courant
        if modele.joueur_courant == 1:
            col = joueur1_fn(modele) if qui_commence == 1 else joueur2_fn(modele)
            qui_joue = 1 if qui_commence == 1 else 2
        else:
            col = joueur2_fn(modele) if qui_commence == 1 else joueur1_fn(modele)
            qui_joue = 2 if qui_commence == 1 else 1

        if col is None:
            return 0

        lig = modele.jouer_coup(col)
        if lig is None:
            # Coup invalide → forfait
            return 2 if qui_joue == 1 else 1

        if verbose:
            afficher_plateau(modele.plateau)

        # Vérifier victoire
        if modele._verifier_victoire_sur_plateau(modele.plateau, modele.joueur_courant):
            return qui_joue

        # Vérifier nul
        if modele.plateau_plein():
            return 0

        modele.changer_joueur()


# =========================================================
# JOUEURS
# =========================================================

def make_minimax_pur(profondeur):
    """Retourne une fonction qui joue avec Minimax pur."""
    def jouer(modele):
        scores = modele.calculer_scores_minimax(profondeur, temps_max=10.0)
        if not scores:
            return modele.coup_aleatoire()
        return max(scores, key=scores.get)
    return jouer


def make_cnn_pur(ia_cnn):
    """Retourne une fonction qui joue uniquement avec le CNN."""
    def jouer(modele):
        valides = modele.colonnes_valides()
        if not valides:
            return None
        col, _, _ = ia_cnn.meilleur_coup(modele.plateau, modele.joueur_courant, valides)
        return col
    return jouer


def make_minimax_cnn(modele_jeu, ia_cnn, profondeur):
    """Retourne une fonction MinimaxCNN (hybride)."""
    minimax_cnn = MinimaxCNN(modele_jeu, ia_cnn, profondeur)
    def jouer(modele):
        scores = minimax_cnn.calculer_meilleur_coup()
        if not scores:
            return modele.coup_aleatoire()
        return max(scores, key=scores.get)
    return jouer


# =========================================================
# DUEL
# =========================================================

def duel(nom_a, joueur_a, nom_b, joueur_b, nb_parties, modele):
    """
    Joue nb_parties entre A et B.
    Alterne qui commence pour être équitable.
    """
    print(f"\n{'='*60}")
    print(f"  {nom_a}  VS  {nom_b}")
    print(f"  {nb_parties} parties (alternance qui commence)")
    print(f"{'='*60}")

    victoires_a = 0
    victoires_b = 0
    nuls = 0

    t0 = time.time()

    for i in range(nb_parties):
        # Alterne qui commence
        qui_commence = 1 if i % 2 == 0 else 2

        if qui_commence == 1:
            # A commence (Rouge)
            res = jouer_partie(joueur_a, joueur_b, modele, qui_commence=1)
            if res == 1: victoires_a += 1
            elif res == 2: victoires_b += 1
            else: nuls += 1
        else:
            # B commence (Rouge)
            res = jouer_partie(joueur_b, joueur_a, modele, qui_commence=1)
            if res == 1: victoires_b += 1
            elif res == 2: victoires_a += 1
            else: nuls += 1

        # Progress
        print(f"  Partie {i+1:2d}/{nb_parties}  →  "
              f"{nom_a}: {victoires_a}  |  {nom_b}: {victoires_b}  |  Nuls: {nuls}",
              end="\r")

    elapsed = time.time() - t0
    print()  # newline après le \r

    pct_a = victoires_a / nb_parties * 100
    pct_b = victoires_b / nb_parties * 100
    pct_n = nuls / nb_parties * 100

    print(f"\n  RÉSULTAT FINAL :")
    print(f"    {nom_a:25s} : {victoires_a:3d} victoires ({pct_a:5.1f}%)")
    print(f"    {nom_b:25s} : {victoires_b:3d} victoires ({pct_b:5.1f}%)")
    print(f"    {'Nuls':25s} : {nuls:3d}            ({pct_n:5.1f}%)")
    print(f"    Temps total : {elapsed:.1f}s ({elapsed/nb_parties:.1f}s/partie)")

    return victoires_a, victoires_b, nuls


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":
    print("\n" + "="*60)
    print("  TEST CNN vs MINIMAX")
    print("="*60)

    # Vérifier modèle
    if not os.path.exists(CHEMIN_MODELE):
        print(f"\n❌ Modèle introuvable : {CHEMIN_MODELE}")
        print("   Place le fichier .pt téléchargé depuis Kaggle ici.")
        exit(1)

    # Charger CNN
    print("\n📥 Chargement du CNN...")
    ia_cnn = IAJoueurCNN(CHEMIN_MODELE)
    if not ia_cnn.est_pret():
        print("❌ Impossible de charger le CNN")
        exit(1)

    # Modèle de jeu
    modele = Puissance4Modele()

    # Joueurs
    minimax_pur = make_minimax_pur(PROFONDEUR_MINIMAX_PUR)
    cnn_pur     = make_cnn_pur(ia_cnn)
    minimax_cnn = make_minimax_cnn(modele, ia_cnn, PROFONDEUR_MINIMAX_CNN)

    # =========================================================
    # DUEL 1 : CNN PUR vs MINIMAX PROFONDEUR 4
    # =========================================================
    res1 = duel(
        f"CNN pur",
        cnn_pur,
        f"Minimax prof {PROFONDEUR_MINIMAX_PUR}",
        minimax_pur,
        NB_PARTIES_CNN_PUR,
        modele
    )

    # =========================================================
    # DUEL 2 : MINIMAX-CNN vs MINIMAX PROFONDEUR 4
    # =========================================================
    res2 = duel(
        f"MinimaxCNN prof {PROFONDEUR_MINIMAX_CNN}",
        minimax_cnn,
        f"Minimax prof {PROFONDEUR_MINIMAX_PUR}",
        minimax_pur,
        NB_PARTIES_HYBRIDE,
        modele
    )

    # =========================================================
    # RÉCAP
    # =========================================================
    print("\n" + "="*60)
    print("  RÉCAPITULATIF GLOBAL")
    print("="*60)
    print(f"  CNN pur          vs Minimax 4 : {res1[0]}-{res1[1]}-{res1[2]}")
    print(f"  MinimaxCNN 4     vs Minimax 4 : {res2[0]}-{res2[1]}-{res2[2]}")
    print()