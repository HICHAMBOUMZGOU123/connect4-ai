# export_dataset.py
# Lit la BD PostgreSQL locale et genere un fichier .npz
# pret a uploader sur Kaggle pour entrainer le CNN.
#
# Usage :
#   python export_dataset.py
#   python export_dataset.py --output mon_dataset.npz --limit 1000
#
# Le fichier .npz contient :
#   - X        : tensors (N, 3, 9, 9) input du CNN
#   - y_policy : labels one-hot (N, 9) coup joue
#   - y_value  : labels (N, 1) -1/0/+1 resultat final
#
# Ponderation appliquee :
#   - confiance 1 (aleatoires) : x1
#   - confiance 2 (Minimax)    : x3
#   - confiance 3 (top BGA)    : x10
# + augmentation par symetrie horizontale (x2 automatique)

import os
import sys
import argparse
import numpy as np
from tqdm import tqdm

# Importe ton db.py existant
from db import get_conn


# =========================================================
# CONFIGURATION
# =========================================================

LIGNES   = 9
COLONNES = 9

REPETITIONS = {
    1: 1,
    2: 3,
    3: 10,
}


# =========================================================
# OUTILS PLATEAU
# =========================================================

def reconstruire_plateau(coups_str, jusqu_a_coup):
    """Rejoue les `jusqu_a_coup` premiers coups, retourne (plateau, joueur_qui_doit_jouer)."""
    plateau = [[0] * COLONNES for _ in range(LIGNES)]
    joueur  = 1

    for i, ch in enumerate(coups_str):
        if i >= jusqu_a_coup:
            break
        if not ch.isdigit():
            continue
        col = int(ch) - 1
        if col < 0 or col >= COLONNES:
            continue
        for lig in range(LIGNES - 1, -1, -1):
            if plateau[lig][col] == 0:
                plateau[lig][col] = joueur
                break
        joueur = 2 if joueur == 1 else 1

    return plateau, joueur


def plateau_vers_tensor_np(plateau, joueur_courant):
    """Version NumPy pure (sans PyTorch) — plus rapide pour bulk export."""
    p = np.array(plateau, dtype=np.float32)
    adv = 2 if joueur_courant == 1 else 1

    canal0 = (p == joueur_courant).astype(np.float32)
    canal1 = (p == adv).astype(np.float32)
    canal2 = np.full((LIGNES, COLONNES),
                     1.0 if joueur_courant == 1 else 0.0,
                     dtype=np.float32)

    return np.stack([canal0, canal1, canal2], axis=0)


def miroir_plateau(plateau):
    return [ligne[::-1] for ligne in plateau]


def resultat_vers_value(resultat, joueur_courant):
    if resultat == "rouge":
        return 1.0 if joueur_courant == 1 else -1.0
    elif resultat == "jaune":
        return 1.0 if joueur_courant == 2 else -1.0
    return 0.0


# =========================================================
# EXPORT
# =========================================================

def exporter_dataset(output_file, limite=None):

    print(f"\n{'=' * 60}")
    print(f"EXPORT DATASET DEPUIS POSTGRESQL")
    print(f"{'=' * 60}\n")

    print("📡 Connexion a la BD...")
    try:
        conn = get_conn()
    except Exception as e:
        print(f"❌ Erreur connexion : {e}")
        print("\n💡 Verifie que :")
        print("   1. Ton fichier .env contient DATABASE_URL")
        print("   2. PostgreSQL est lance localement")
        sys.exit(1)

    cur = conn.cursor()

    query = """
        SELECT g.resultat, g.confiance, c.coups, g.couleur_depart
        FROM games g
        JOIN games_coups c ON c.game_id = g.id
        WHERE g.resultat IS NOT NULL
          AND g.resultat != ''
          AND c.coups IS NOT NULL
          AND LENGTH(c.coups) > 0
        ORDER BY g.confiance DESC
    """
    if limite:
        query += f" LIMIT {limite}"

    print("🔍 Lecture des parties...")
    cur.execute(query)
    parties = cur.fetchall()
    cur.close()
    conn.close()

    print(f"✅ {len(parties):,} parties chargees")

    if len(parties) == 0:
        print("❌ Aucune partie dans la BD !")
        sys.exit(1)

    # Stats par confiance
    stats = {}
    for _, conf, _, _ in parties:
        stats[conf] = stats.get(conf, 0) + 1

    print(f"\n📊 Repartition :")
    for conf, nb in sorted(stats.items()):
        rep = REPETITIONS.get(conf, 1)
        print(f"   Confiance {conf} : {nb:,} parties (x{rep} repetitions)")

    # =========================================================
    # GENERATION DES EXEMPLES
    # =========================================================

    print(f"\n⚙️  Generation des tensors...")

    X_list      = []
    policy_list = []
    value_list  = []
    skipped     = 0

    for resultat, confiance, coups_str, couleur_depart in tqdm(
        parties, desc="Parties"
    ):
        if not coups_str or not resultat:
            skipped += 1
            continue

        coups_str = coups_str.strip()
        nb_coups  = len(coups_str)

        if nb_coups < 4:
            skipped += 1
            continue

        nb_rep = REPETITIONS.get(int(confiance), 1)

        for i in range(nb_coups):
            ch = coups_str[i]
            if not ch.isdigit():
                continue

            col_jouee = int(ch) - 1
            if col_jouee < 0 or col_jouee >= COLONNES:
                continue

            plateau, joueur = reconstruire_plateau(coups_str, i)

            # Policy : one-hot sur la colonne jouee
            policy = np.zeros(COLONNES, dtype=np.float32)
            policy[col_jouee] = 1.0

            value  = resultat_vers_value(resultat, joueur)
            tensor = plateau_vers_tensor_np(plateau, joueur)

            # Symetrie horizontale
            plateau_mir = miroir_plateau(plateau)
            policy_mir  = policy[::-1].copy()
            tensor_mir  = plateau_vers_tensor_np(plateau_mir, joueur)

            for _ in range(nb_rep):
                X_list.append(tensor)
                policy_list.append(policy)
                value_list.append(value)

                X_list.append(tensor_mir)
                policy_list.append(policy_mir)
                value_list.append(value)

    total = len(X_list)
    print(f"\n✅ {total:,} exemples generes")
    print(f"   {skipped} parties ignorees")

    # =========================================================
    # CONVERSION ET SAUVEGARDE
    # =========================================================

    print(f"\n💾 Conversion en arrays NumPy...")
    X        = np.array(X_list,      dtype=np.float32)
    y_policy = np.array(policy_list, dtype=np.float32)
    y_value  = np.array(value_list,  dtype=np.float32).reshape(-1, 1)

    # Liberer la memoire des listes
    del X_list, policy_list, value_list

    print(f"\n📐 Dimensions :")
    print(f"   X        : {X.shape}        → {X.nbytes / 1024 / 1024:.1f} MB")
    print(f"   y_policy : {y_policy.shape}  → {y_policy.nbytes / 1024 / 1024:.1f} MB")
    print(f"   y_value  : {y_value.shape}  → {y_value.nbytes / 1024 / 1024:.1f} MB")
    total_mb = (X.nbytes + y_policy.nbytes + y_value.nbytes) / 1024 / 1024
    print(f"   Total    : {total_mb:.1f} MB")

    print(f"\n💾 Sauvegarde dans {output_file}...")
    np.savez_compressed(
        output_file,
        X        = X,
        y_policy = y_policy,
        y_value  = y_value,
    )

    taille_fichier = os.path.getsize(output_file) / 1024 / 1024
    print(f"\n🎉 Termine !")
    print(f"   Fichier : {output_file}")
    print(f"   Taille  : {taille_fichier:.1f} MB (compresse)")
    print(f"\n👉 Prochaine etape : upload sur Kaggle comme Dataset prive")


# =========================================================
# MAIN
# =========================================================

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--output",
        type=str,
        default="puissance4_dataset.npz",
        help="Nom du fichier de sortie",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limiter le nombre de parties (pour tester)",
    )
    args = parser.parse_args()

    exporter_dataset(args.output, args.limit)