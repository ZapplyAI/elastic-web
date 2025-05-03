export interface Template {
  name: string;
  label: string;
  description: string;
  githubRepo: string;
  branch?: string;
  tags?: string[];
  icon?: string;
}
