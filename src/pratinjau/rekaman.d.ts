declare module 'virtual:rekaman' {
  const rekaman: {
    direkam: string;
    admin: { pengguna: unknown };
    rekaman: Record<string, { status: number; isi: unknown }>;
    status: Record<string, { whatsapp: string; isi: unknown }>;
  };
  export default rekaman;
}
