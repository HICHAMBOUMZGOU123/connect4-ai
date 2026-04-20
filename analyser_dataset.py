# analyser_dataset.py
# Analyse les statistiques de ta BD pour estimer
# la qualite de tes parties Minimax (profondeur)

from db import get_conn
from collections import Counter


def analyser():

    print("=" * 60)
    print("ANALYSE DE TA BASE DE DONNEES")
    print("=" * 60)

    conn = get_conn()
    cur  = conn.cursor()

    # =========================================================
    # 1) Nombre total de parties par confiance
    # =========================================================

    cur.execute("""
        SELECT confiance, COUNT(*)
        FROM games
        WHERE resultat IS NOT NULL AND resultat != ''
        GROUP BY confiance
        ORDER BY confiance
    """)

    print("\n📊 PARTIES PAR CONFIANCE\n")
    for conf, nb in cur.fetchall():
        nom = {1: "aleatoires", 2: "Minimax   ", 3: "top BGA   "}.get(conf, "?")
        print(f"   Confiance {conf} ({nom}) : {nb:,} parties")

    # =========================================================
    # 2) Stats des parties Minimax (confiance 2) - les plus importantes
    # =========================================================

    print("\n🔍 ANALYSE DES PARTIES MINIMAX (confiance 2)\n")

    cur.execute("""
        SELECT g.resultat, LENGTH(c.coups) as nb_coups
        FROM games g
        JOIN games_coups c ON c.game_id = g.id
        WHERE g.confiance = 2
          AND g.resultat IS NOT NULL
          AND g.resultat != ''
    """)

    parties = cur.fetchall()

    if not parties:
        print("   Aucune partie Minimax trouvee.")
        return

    longueurs = [nb for _, nb in parties]
    resultats = Counter(r for r, _ in parties)

    longueur_moy = sum(longueurs) / len(longueurs)
    longueur_min = min(longueurs)
    longueur_max = max(longueurs)

    nb_total   = len(parties)
    nb_rouge   = resultats.get("rouge", 0)
    nb_jaune   = resultats.get("jaune", 0)
    nb_nul     = resultats.get("nul",   0)

    print(f"   Total parties      : {nb_total:,}")
    print(f"   Longueur moyenne   : {longueur_moy:.1f} coups")
    print(f"   Longueur min/max   : {longueur_min} / {longueur_max} coups")
    print()
    print(f"   Victoires Rouge    : {nb_rouge:>6} ({100*nb_rouge/nb_total:5.1f}%)")
    print(f"   Victoires Jaune    : {nb_jaune:>6} ({100*nb_jaune/nb_total:5.1f}%)")
    print(f"   Nuls               : {nb_nul:>6} ({100*nb_nul/nb_total:5.1f}%)")

    # =========================================================
    # 3) Distribution des longueurs (histogramme texte)
    # =========================================================

    print("\n📏 DISTRIBUTION DES LONGUEURS\n")

    bins = {
        "10-19": 0,
        "20-29": 0,
        "30-39": 0,
        "40-49": 0,
        "50-59": 0,
        "60-69": 0,
        "70+":   0,
    }

    for n in longueurs:
        if   n < 20: bins["10-19"] += 1
        elif n < 30: bins["20-29"] += 1
        elif n < 40: bins["30-39"] += 1
        elif n < 50: bins["40-49"] += 1
        elif n < 60: bins["50-59"] += 1
        elif n < 70: bins["60-69"] += 1
        else:        bins["70+"]   += 1

    max_count = max(bins.values())
    bar_max   = 40

    for label, count in bins.items():
        bar_len = int(count / max_count * bar_max) if max_count > 0 else 0
        bar     = "█" * bar_len
        pct     = 100 * count / nb_total
        print(f"   {label:>6} coups : {bar:<{bar_max}} {count:>6} ({pct:5.1f}%)")

    # =========================================================
    # 4) Verdict
    # =========================================================

    print("\n🎯 VERDICT\n")

    pct_nul = 100 * nb_nul / nb_total

    if longueur_moy >= 55:
        print("   📌 Parties LONGUES  : probablement profondeur Minimax FAIBLE (3-4)")
        print("      Le CNN apprendra un niveau correct mais pas exceptionnel.")
    elif longueur_moy >= 40:
        print("   📌 Parties MOYENNES : probablement profondeur Minimax 5-6")
        print("      Le CNN apprendra un niveau bon a tres bon.")
    else:
        print("   📌 Parties COURTES  : probablement profondeur Minimax 7+")
        print("      Le CNN apprendra un niveau excellent (potentiel quasi-parfait).")

    print()

    if pct_nul > 25:
        print("   📌 Beaucoup de nuls : les deux IA jouent prudemment")
        print("      Le dataset enseigne bien la defense, moins l'attaque.")
    elif pct_nul < 10:
        print("   📌 Peu de nuls : les IA prennent des risques")
        print("      Le dataset enseigne bien l'attaque tactique.")
    else:
        print("   📌 Equilibre normal entre nuls et victoires.")

    print()

    # Avantage premier joueur (Rouge commence souvent)
    pct_rouge_vs_jaune = nb_rouge / max(nb_jaune, 1)
    if pct_rouge_vs_jaune > 1.3:
        print(f"   📌 Rouge gagne {pct_rouge_vs_jaune:.1f}x plus que Jaune")
        print("      Premier joueur a un GROS avantage = parties precises.")

    print()
    print("=" * 60)

    cur.close()
    conn.close()


if __name__ == "__main__":
    analyser()