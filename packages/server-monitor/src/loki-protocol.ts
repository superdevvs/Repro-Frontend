import protobuf from "protobufjs";
import snappy from "snappyjs";
const Push = protobuf
  .parse(
    `syntax="proto3"; message Timestamp { int64 seconds=1; int32 nanos=2; } message Entry { Timestamp timestamp=1; string line=2; } message Stream { string labels=1; repeated Entry entries=2; uint64 hash=3; } message PushRequest { repeated Stream streams=1; }`,
  )
  .root.lookupType("PushRequest");
export function decodeLokiPush(input: Buffer) {
  // Validate Snappy's declared output size before its decoder allocates memory.
  let size = 0,
    shift = 0,
    index = 0;
  for (; index < 5 && index < input.length; index++) {
    const b = input[index];
    size += (b & 127) * 2 ** shift;
    if (!(b & 128)) break;
    shift += 7;
  }
  if (index === 5 || size > 2_000_000 || size < 0)
    throw new Error("Log batch exceeds decompression limit");
  const decoded = Push.toObject(Push.decode(snappy.uncompress(input)), {
    longs: String,
  }) as {
    streams: {
      labels: string;
      entries: {
        timestamp: { seconds: string; nanos?: number };
        line?: string;
      }[];
    }[];
  };
  return {
    streams: (decoded.streams ?? []).map((s) => {
      const match = s.labels.match(/(?:^\{|,\s*)source="((?:\\.|[^"\\])*)"/);
      if (!match) throw new Error("Log source label required");
      const source = JSON.parse(`"${match[1]}"`);
      return {
        stream: { source },
        values: (s.entries ?? []).map((e) => [
          (
            BigInt(e.timestamp.seconds) * 1000000000n +
            BigInt(e.timestamp.nanos ?? 0)
          ).toString(),
          // Proto3 omits an empty string on the wire; it is a valid blank log line.
          e.line ?? "",
        ]),
      };
    }),
  };
}
