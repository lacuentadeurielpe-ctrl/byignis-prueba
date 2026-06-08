export type ModuleName =
  | 'dashboard'
  | 'pos'
  | 'ventas'
  | 'chat'
  | 'catalog'
  | 'clientes'
  | 'finanzas'
  | 'crm'
  | 'creditos'
  | 'delivery'
  | 'comprobantes'
  | 'salud'
  | 'settings'
  | 'settings-2';

const DEFAULT_ACTIVE_MODULES: ModuleName[] = [
  'dashboard',
  'pos',
  'ventas',
  'chat',
  'catalog',
  'clientes',
  'finanzas',
  'settings',
  'settings-2'
];

export function isModuleEnabled(module: ModuleName): boolean {
  const envVar = process.env.NEXT_PUBLIC_ACTIVE_MODULES;
  if (!envVar) {
    // Si no está definida la variable de entorno, activar solo los estables/funcionales
    return DEFAULT_ACTIVE_MODULES.includes(module);
  }
  const activeList = envVar.split(',').map(m => m.trim() as ModuleName);
  return activeList.includes(module);
}
