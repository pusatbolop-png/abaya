// Basis data pratinjau: SQLite (sql.js, versi JavaScript murni) dengan antarmuka yang sama seperti better-sqlite3
// sebatas yang dipakai server: prepare().all/get/run, transaction, pragma, exec.
import type { Database, SqlValue, Statement } from 'sql.js';

type Param = string | number | boolean | null | undefined;
const rapikan = (p: Param[]): SqlValue[] => p.map((v) => (v === undefined ? null : typeof v === 'boolean' ? (v ? 1 : 0) : v));

export class DbPratinjau {
  private simpanan = new Map<string, Statement>();
  private kedalaman = 0;

  constructor(private db: Database) {}

  private pernyataan(sql: string) {
    let st = this.simpanan.get(sql);
    if (!st) {
      st = this.db.prepare(sql);
      this.simpanan.set(sql, st);
    }
    return st;
  }

  prepare(sql: string) {
    const sisip = /^\s*insert/i.test(sql);
    return {
      all: (...p: Param[]) => {
        const st = this.pernyataan(sql);
        st.bind(rapikan(p));
        const baris: Record<string, SqlValue>[] = [];
        while (st.step()) baris.push(st.getAsObject());
        st.reset();
        return baris;
      },
      get: (...p: Param[]) => {
        const st = this.pernyataan(sql);
        st.bind(rapikan(p));
        const hasil = st.step() ? st.getAsObject() : undefined;
        st.reset();
        return hasil;
      },
      run: (...p: Param[]) => {
        const st = this.pernyataan(sql);
        st.bind(rapikan(p));
        st.step();
        st.reset();
        const changes = this.db.getRowsModified();
        let lastInsertRowid = 0;
        if (sisip) {
          const id = this.pernyataan('SELECT last_insert_rowid() AS id');
          lastInsertRowid = Number(id.getAsObject({}).id);
          id.reset();
        }
        return { changes, lastInsertRowid };
      },
    };
  }

  transaction<A extends unknown[], R>(fn: (...a: A) => R) {
    return (...a: A): R => {
      const tingkat = this.kedalaman++;
      this.db.exec(tingkat === 0 ? 'BEGIN' : `SAVEPOINT t${tingkat}`);
      try {
        const hasil = fn(...a);
        this.db.exec(tingkat === 0 ? 'COMMIT' : `RELEASE t${tingkat}`);
        return hasil;
      } catch (e) {
        this.db.exec(tingkat === 0 ? 'ROLLBACK' : `ROLLBACK TO t${tingkat}; RELEASE t${tingkat}`);
        throw e;
      } finally {
        this.kedalaman--;
      }
    };
  }

  pragma(isi: string, opsi?: { simple?: boolean }) {
    const hasil = this.db.exec(`PRAGMA ${isi}`);
    if (opsi?.simple) return hasil[0]?.values[0]?.[0];
    const r = hasil[0];
    return r ? r.values.map((v) => Object.fromEntries(r.columns.map((c, i) => [c, v[i]]))) : [];
  }

  exec(sql: string) {
    this.db.exec(sql);
    return this;
  }
}
