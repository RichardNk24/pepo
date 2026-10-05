// Source images stay unchanged. These windows remove transparent padding at render time.
export const VEHICLE_METRICS = {
  taxi: {
    width: 628,
    height: 1394,
    x: 0,
    y: 0,
    cropWidth: 728,
    cropHeight: 1494,
    displayHeight: 54,
  },
  moto: {
    width: 1254,
    height: 1254,
    x: 339,
    y: 37,
    cropWidth: 576,
    cropHeight: 1177,
    displayHeight: 32,
  },
};
export type VehicleImageUrls = Record<
  import("@pepo/types/model").VehicleKind,
  string
>;
