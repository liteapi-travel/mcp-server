import fs from 'fs';
import path from 'path';

export function loadOpenApiSpecs(dir: string): Record<string, any> {
  const specs: Record<string, any> = {};
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.json'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf-8');
    specs[file] = JSON.parse(raw);
  }
  return specs;
}
