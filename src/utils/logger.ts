import kleur from "kleur";

export const logger = {
  info(message: string): void {
    console.log(kleur.cyan("[INFO]"), message);
  },
  success(message: string): void {
    console.log(kleur.green("[OK]"), message);
  },
  warn(message: string): void {
    console.warn(kleur.yellow("[WARN]"), message);
  },
  error(message: string): void {
    console.error(kleur.red("[ERROR]"), message);
  }
};
