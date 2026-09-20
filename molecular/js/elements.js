/* Tableau périodique : données atomiques utilisées par toute l'application.
   Colonnes : Z | symbole | nom | masse molaire (g/mol) | groupe (0 = bloc f) | période |
              électronégativité de Pauling (0 = non définie) | rayon covalent (Å) |
              rayon de van der Waals (Å) | couleur CPK/Jmol | valence usuelle */
(function () {
  const DATA = `
1|H|Hydrogène|1.008|1|1|2.20|0.31|1.20|FFFFFF|1
2|He|Hélium|4.0026|18|1|0|0.28|1.40|D9FFFF|0
3|Li|Lithium|6.94|1|2|0.98|1.28|1.82|CC80FF|1
4|Be|Béryllium|9.0122|2|2|1.57|0.96|1.53|C2FF00|2
5|B|Bore|10.81|13|2|2.04|0.84|1.92|FFB5B5|3
6|C|Carbone|12.011|14|2|2.55|0.76|1.70|909090|4
7|N|Azote|14.007|15|2|3.04|0.71|1.55|3050F8|3
8|O|Oxygène|15.999|16|2|3.44|0.66|1.52|FF0D0D|2
9|F|Fluor|18.998|17|2|3.98|0.57|1.47|90E050|1
10|Ne|Néon|20.180|18|2|0|0.58|1.54|B3E3F5|0
11|Na|Sodium|22.990|1|3|0.93|1.66|2.27|AB5CF2|1
12|Mg|Magnésium|24.305|2|3|1.31|1.41|1.73|8AFF00|2
13|Al|Aluminium|26.982|13|3|1.61|1.21|1.84|BFA6A6|3
14|Si|Silicium|28.085|14|3|1.90|1.11|2.10|F0C8A0|4
15|P|Phosphore|30.974|15|3|2.19|1.07|1.80|FF8000|3
16|S|Soufre|32.06|16|3|2.58|1.05|1.80|FFFF30|2
17|Cl|Chlore|35.45|17|3|3.16|1.02|1.75|1FF01F|1
18|Ar|Argon|39.95|18|3|0|1.06|1.88|80D1E3|0
19|K|Potassium|39.098|1|4|0.82|2.03|2.75|8F40D4|1
20|Ca|Calcium|40.078|2|4|1.00|1.76|2.31|3DFF00|2
21|Sc|Scandium|44.956|3|4|1.36|1.70|2.11|E6E6E6|3
22|Ti|Titane|47.867|4|4|1.54|1.60|2.00|BFC2C7|4
23|V|Vanadium|50.942|5|4|1.63|1.53|2.00|A6A6AB|5
24|Cr|Chrome|51.996|6|4|1.66|1.39|2.00|8A99C7|6
25|Mn|Manganèse|54.938|7|4|1.55|1.39|2.00|9C7AC7|4
26|Fe|Fer|55.845|8|4|1.83|1.32|2.00|E06633|3
27|Co|Cobalt|58.933|9|4|1.88|1.26|2.00|F090A0|3
28|Ni|Nickel|58.693|10|4|1.91|1.24|1.63|50D050|2
29|Cu|Cuivre|63.546|11|4|1.90|1.32|1.40|C88033|2
30|Zn|Zinc|65.38|12|4|1.65|1.22|1.39|7D80B0|2
31|Ga|Gallium|69.723|13|4|1.81|1.22|1.87|C28F8F|3
32|Ge|Germanium|72.630|14|4|2.01|1.20|2.11|668F8F|4
33|As|Arsenic|74.922|15|4|2.18|1.19|1.85|BD80E3|3
34|Se|Sélénium|78.971|16|4|2.55|1.20|1.90|FFA100|2
35|Br|Brome|79.904|17|4|2.96|1.20|1.85|A62929|1
36|Kr|Krypton|83.798|18|4|3.00|1.16|2.02|5CB8D1|0
37|Rb|Rubidium|85.468|1|5|0.82|2.20|3.03|702EB0|1
38|Sr|Strontium|87.62|2|5|0.95|1.95|2.49|00FF00|2
39|Y|Yttrium|88.906|3|5|1.22|1.90|2.00|94FFFF|3
40|Zr|Zirconium|91.224|4|5|1.33|1.75|2.00|94E0E0|4
41|Nb|Niobium|92.906|5|5|1.60|1.64|2.00|73C2C9|5
42|Mo|Molybdène|95.95|6|5|2.16|1.54|2.00|54B5B5|6
43|Tc|Technétium|98|7|5|1.90|1.47|2.00|3B9E9E|7
44|Ru|Ruthénium|101.07|8|5|2.20|1.46|2.00|248F8F|4
45|Rh|Rhodium|102.91|9|5|2.28|1.42|2.00|0A7D8C|3
46|Pd|Palladium|106.42|10|5|2.20|1.39|1.63|006985|2
47|Ag|Argent|107.87|11|5|1.93|1.45|1.72|C0C0C0|1
48|Cd|Cadmium|112.41|12|5|1.69|1.44|1.58|FFD98F|2
49|In|Indium|114.82|13|5|1.78|1.42|1.93|A67573|3
50|Sn|Étain|118.71|14|5|1.96|1.39|2.17|668080|4
51|Sb|Antimoine|121.76|15|5|2.05|1.39|2.06|9E63B5|3
52|Te|Tellure|127.60|16|5|2.10|1.38|2.06|D47A00|2
53|I|Iode|126.90|17|5|2.66|1.39|1.98|940094|1
54|Xe|Xénon|131.29|18|5|2.60|1.40|2.16|429EB0|0
55|Cs|Césium|132.91|1|6|0.79|2.44|3.43|57178F|1
56|Ba|Baryum|137.33|2|6|0.89|2.15|2.68|00C900|2
57|La|Lanthane|138.91|3|6|1.10|2.07|2.00|70D4FF|3
58|Ce|Cérium|140.12|0|6|1.12|2.04|2.00|FFFFC7|3
59|Pr|Praséodyme|140.91|0|6|1.13|2.03|2.00|D9FFC7|3
60|Nd|Néodyme|144.24|0|6|1.14|2.01|2.00|C7FFC7|3
61|Pm|Prométhium|145|0|6|1.13|1.99|2.00|A3FFC7|3
62|Sm|Samarium|150.36|0|6|1.17|1.98|2.00|8FFFC7|3
63|Eu|Europium|151.96|0|6|1.20|1.98|2.00|61FFC7|3
64|Gd|Gadolinium|157.25|0|6|1.20|1.96|2.00|45FFC7|3
65|Tb|Terbium|158.93|0|6|1.10|1.94|2.00|30FFC7|3
66|Dy|Dysprosium|162.50|0|6|1.22|1.92|2.00|1FFFC7|3
67|Ho|Holmium|164.93|0|6|1.23|1.92|2.00|00FF9C|3
68|Er|Erbium|167.26|0|6|1.24|1.89|2.00|00E675|3
69|Tm|Thulium|168.93|0|6|1.25|1.90|2.00|00D452|3
70|Yb|Ytterbium|173.05|0|6|1.10|1.87|2.00|00BF38|3
71|Lu|Lutécium|174.97|3|6|1.27|1.87|2.00|00AB24|3
72|Hf|Hafnium|178.49|4|6|1.30|1.75|2.00|4DC2FF|4
73|Ta|Tantale|180.95|5|6|1.50|1.70|2.00|4DA6FF|5
74|W|Tungstène|183.84|6|6|2.36|1.62|2.00|2194D6|6
75|Re|Rhénium|186.21|7|6|1.90|1.51|2.00|267DAB|7
76|Os|Osmium|190.23|8|6|2.20|1.44|2.00|266696|4
77|Ir|Iridium|192.22|9|6|2.20|1.41|2.00|175487|4
78|Pt|Platine|195.08|10|6|2.28|1.36|1.75|D0D0E0|4
79|Au|Or|196.97|11|6|2.54|1.36|1.66|FFD123|3
80|Hg|Mercure|200.59|12|6|2.00|1.32|1.55|B8B8D0|2
81|Tl|Thallium|204.38|13|6|1.62|1.45|1.96|A6544D|3
82|Pb|Plomb|207.2|14|6|2.33|1.46|2.02|575961|4
83|Bi|Bismuth|208.98|15|6|2.02|1.48|2.07|9E4FB5|3
84|Po|Polonium|209|16|6|2.00|1.40|1.97|AB5C00|2
85|At|Astate|210|17|6|2.20|1.50|2.02|754F45|1
86|Rn|Radon|222|18|6|2.20|1.50|2.20|428296|0
87|Fr|Francium|223|1|7|0.70|2.60|3.48|420066|1
88|Ra|Radium|226|2|7|0.90|2.21|2.83|007D00|2
89|Ac|Actinium|227|3|7|1.10|2.15|2.00|70ABFA|3
90|Th|Thorium|232.04|0|7|1.30|2.06|2.00|00BAFF|4
91|Pa|Protactinium|231.04|0|7|1.50|2.00|2.00|00A1FF|5
92|U|Uranium|238.03|0|7|1.38|1.96|1.86|008FFF|6
93|Np|Neptunium|237|0|7|1.36|1.90|2.00|0080FF|5
94|Pu|Plutonium|244|0|7|1.28|1.87|2.00|006BFF|4
95|Am|Américium|243|0|7|1.13|1.80|2.00|545CF2|3
96|Cm|Curium|247|0|7|1.28|1.69|2.00|785CE3|3
97|Bk|Berkélium|247|0|7|1.30|1.68|2.00|8A4FE3|3
98|Cf|Californium|251|0|7|1.30|1.68|2.00|A136D4|3
99|Es|Einsteinium|252|0|7|1.30|1.65|2.00|B31FD4|3
100|Fm|Fermium|257|0|7|1.30|1.67|2.00|B31FBA|3
101|Md|Mendélévium|258|0|7|1.30|1.73|2.00|B30DA6|3
102|No|Nobélium|259|0|7|1.30|1.76|2.00|BD0D87|3
103|Lr|Lawrencium|266|3|7|1.30|1.61|2.00|C70066|3
104|Rf|Rutherfordium|267|4|7|0|1.57|2.00|CC0059|4
105|Db|Dubnium|268|5|7|0|1.49|2.00|D1004F|5
106|Sg|Seaborgium|269|6|7|0|1.43|2.00|D90045|6
107|Bh|Bohrium|270|7|7|0|1.41|2.00|E00038|7
108|Hs|Hassium|269|8|7|0|1.34|2.00|E6002E|8
109|Mt|Meitnérium|278|9|7|0|1.29|2.00|EB0026|6
110|Ds|Darmstadtium|281|10|7|0|1.28|2.00|EB0026|6
111|Rg|Roentgenium|282|11|7|0|1.21|2.00|EB0026|3
112|Cn|Copernicium|285|12|7|0|1.22|2.00|EB0026|2
113|Nh|Nihonium|286|13|7|0|1.36|2.00|EB0026|3
114|Fl|Flérovium|289|14|7|0|1.43|2.00|EB0026|4
115|Mc|Moscovium|290|15|7|0|1.62|2.00|EB0026|3
116|Lv|Livermorium|293|16|7|0|1.75|2.00|EB0026|2
117|Ts|Tennesse|294|17|7|0|1.65|2.00|EB0026|1
118|Og|Oganesson|294|18|7|0|1.57|2.00|EB0026|0`.trim();

  /* Ordre de remplissage (règle de Klechkowski / n+l croissant) */
  const ORBITALS = [
    ['1s', 2], ['2s', 2], ['2p', 6], ['3s', 2], ['3p', 6], ['4s', 2], ['3d', 10], ['4p', 6],
    ['5s', 2], ['4d', 10], ['5p', 6], ['6s', 2], ['4f', 14], ['5d', 10], ['6p', 6],
    ['7s', 2], ['5f', 14], ['6d', 10], ['7p', 6],
  ];
  /* Exceptions expérimentales à la règle de Klechkowski (stabilité des sous-couches d⁵ et d¹⁰) */
  const EXCEPT = {
    24: '1s2 2s2 2p6 3s2 3p6 3d5 4s1', 29: '1s2 2s2 2p6 3s2 3p6 3d10 4s1',
    41: '[Kr] 4d4 5s1', 42: '[Kr] 4d5 5s1', 44: '[Kr] 4d7 5s1', 45: '[Kr] 4d8 5s1',
    46: '[Kr] 4d10', 47: '[Kr] 4d10 5s1', 78: '[Xe] 4f14 5d9 6s1', 79: '[Xe] 4f14 5d10 6s1',
  };
  const NOBLE = { 2: 'He', 10: 'Ne', 18: 'Ar', 36: 'Kr', 54: 'Xe', 86: 'Rn' };

  /* Configuration électronique complète d'un atome à Z électrons */
  function configuration(Z) {
    if (EXCEPT[Z]) return EXCEPT[Z];
    let left = Z; const parts = [];
    for (const [name, cap] of ORBITALS) {
      if (left <= 0) break;
      const n = Math.min(cap, left); left -= n;
      parts.push(name + n);
    }
    return parts.join(' ');
  }
  /* Forme abrégée : [gaz rare] + électrons externes */
  function configurationCourte(Z) {
    let core = 0, sym = null;
    for (const z of [86, 54, 36, 18, 10, 2]) if (Z > z) { core = z; sym = NOBLE[z]; break; }
    if (!sym) return configuration(Z);
    const full = configuration(Z).split(' ');
    const coreFull = configuration(core).split(' ');
    return '[' + sym + '] ' + full.slice(coreFull.length).join(' ');
  }
  /* Électrons de valence (couche de nombre quantique n maximal, + d incomplète) */
  function valenceElectrons(e) {
    if (e.group === 0) return 3;                        // approximation pour le bloc f
    if (e.group >= 3 && e.group <= 12) return e.group;  // métaux de transition : n s + (n−1) d
    if (e.group <= 2) return e.group;
    return e.group - 10;                                 // blocs p : colonne 13 → 3 e⁻ …
  }

  const list = DATA.split('\n').map(line => {
    const c = line.split('|');
    const e = {
      Z: +c[0], sym: c[1], name: c[2], mass: +c[3], group: +c[4], period: +c[5],
      en: +c[6] || 0, rcov: +c[7], rvdw: +c[8], color: '#' + c[9], valence: +c[10],
    };
    e.block = e.group === 0 ? 'f' : e.group <= 2 ? (e.Z === 2 ? 's' : 's') : e.group <= 12 ? 'd' : 'p';
    if (e.Z === 1 || e.Z === 2) e.block = 's';
    e.config = configuration(e.Z);
    e.configCourte = configurationCourte(e.Z);
    e.ve = valenceElectrons(e);
    e.metal = !(e.group >= 14 && e.en >= 2.0) && !(e.group >= 13 && e.period <= 2 && e.Z !== 5) ? true : false;
    return e;
  });

  const bySym = {}, byZ = {};
  list.forEach(e => { bySym[e.sym.toLowerCase()] = e; byZ[e.Z] = e; });

  /* Familles chimiques (pour la coloration du tableau périodique) */
  function famille(e) {
    if (e.group === 18) return 'gaz-noble';
    if (e.group === 17) return 'halogene';
    if (e.group === 1 && e.Z !== 1) return 'alcalin';
    if (e.group === 2) return 'alcalino';
    if (e.group === 0) return e.period === 6 ? 'lanthanide' : 'actinide';
    if (e.group >= 3 && e.group <= 12) return 'transition';
    if (e.Z === 1) return 'hydrogene';
    if (['C', 'N', 'O', 'P', 'S', 'Se'].includes(e.sym)) return 'non-metal';
    if (['B', 'Si', 'Ge', 'As', 'Sb', 'Te', 'Po', 'At'].includes(e.sym)) return 'metalloide';
    return 'metal-pauvre';
  }
  list.forEach(e => { e.famille = famille(e); });

  M.elements = {
    list,
    /* Accès tolérant : « c », « C », « Carbone », 6 */
    get(s) {
      if (s == null) return null;
      if (typeof s === 'number') return byZ[s] || null;
      const k = String(s).trim();
      return bySym[k.toLowerCase()] || list.find(e => e.name.toLowerCase() === k.toLowerCase()) || byZ[+k] || null;
    },
    byZ: z => byZ[z] || null,
    /* Éléments courants en chimie organique, dans l'ordre de la palette rapide */
    courants: ['C', 'H', 'O', 'N', 'S', 'P', 'F', 'Cl', 'Br', 'I', 'B', 'Si', 'Na', 'Mg', 'K', 'Ca', 'Fe', 'Cu', 'Zn'],
    configuration, configurationCourte,
    /* Nom des familles pour l'interface */
    familles: {
      'hydrogene': 'Hydrogène', 'alcalin': 'Alcalins', 'alcalino': 'Alcalino-terreux',
      'transition': 'Métaux de transition', 'metal-pauvre': 'Métaux pauvres', 'metalloide': 'Métalloïdes',
      'non-metal': 'Non-métaux', 'halogene': 'Halogènes', 'gaz-noble': 'Gaz nobles',
      'lanthanide': 'Lanthanides', 'actinide': 'Actinides',
    },
  };
})();
