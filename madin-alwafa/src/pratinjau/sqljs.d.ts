declare module 'sql.js/dist/sql-asm-memory-growth.js' {
  import type { SqlJsStatic } from 'sql.js';
  const initSqlJs: (config?: Record<string, unknown>) => Promise<SqlJsStatic>;
  export default initSqlJs;
}
