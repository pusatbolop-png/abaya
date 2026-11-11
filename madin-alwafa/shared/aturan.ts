// Tata tertib kartu santri: satu butir per baris; baris berakhiran titik dua menjadi judul bagian.
export interface BagianAturan {
  judul: string | null;
  butir: string[];
}

export function uraiAturan(teks: string): BagianAturan[] {
  const bagian: BagianAturan[] = [];
  for (const mentah of teks.split(/\r?\n/)) {
    const baris = mentah.trim().replace(/^(\d+[.)]|[-•*])\s*/, '');
    if (!baris) continue;
    if (baris.endsWith(':')) bagian.push({ judul: baris.slice(0, -1).trim(), butir: [] });
    else {
      if (!bagian.length) bagian.push({ judul: null, butir: [] });
      bagian[bagian.length - 1].butir.push(baris);
    }
  }
  return bagian.filter((b) => b.butir.length);
}
