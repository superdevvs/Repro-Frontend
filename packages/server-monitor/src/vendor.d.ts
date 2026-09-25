declare module "snappyjs" {
  const snappy: {
    compress(input: Uint8Array): Uint8Array;
    uncompress(input: Uint8Array): Uint8Array;
  };
  export default snappy;
}
