declare namespace NodeJS {
  interface ProcessEnv {
    NGRV_BUILT_AT: string;
    NGRV_BUILT_AT_ISO: string;
    NGRV_COMMIT_HASH: string;
    NGRV_ENDIANNESS: string;
    NGRV_ARCH: string;
    NGRV_HOMEDIR: string;
    NGRV_TOTALMEM: string;
    NGRV_USERNAME: string;
    NGRV_SHELL: string;
    NGRV_CPUMODEL: string;
    NGRV_NCPUS: string;
  }
}
