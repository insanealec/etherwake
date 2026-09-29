// Job tuning (milestone 5). Courier: fetch a parcel from a buoy out at sea and bring it back to the
// dockmaster's mooring before the timer runs out.
export const COURIER = {
	minDistance: 350, // parcel distance from the harbour (m)
	maxDistance: 900,
	basePay: 25,
	payPerMetre: 0.09, // on the parcel's distance from the harbour
	quickBonus: 0.5, // extra fraction of the pay if delivered with over half the time left
	timePerMetre: 0.24, // seconds allowed per metre of round trip (~8 m/s average with slack)
	timeBase: 30,
	pickupRadius: 4.5
};
