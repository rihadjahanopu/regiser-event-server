import mongoose from "mongoose";

const settingsSchema = new mongoose.Schema(
	{
		eventCoverUrl: {
			type: String,
			default: null,
		},
		eventCoverPublicId: {
			type: String,
			default: null,
		},
		isRegistrationOpen: {
			type: Boolean,
			default: true,
		},
		eventName: {
			type: String,
			default: "",
		},
		eventAddress: {
			type: String,
			default: "",
		},
		eventDate: {
			type: String,
			default: "",
		},
		eventStartTime: {
			type: String,
			default: "",
		},
		organiserContact: {
			type: String,
			default: "",
		},
		showCountdown: {
			type: Boolean,
			default: true,
		},
		// Signature & Authority Config
		presidentName: {
			type: String,
			default: "President",
		},
		presidentTitle: {
			type: String,
			default: "President, Chhatak Uttar",
		},
		presidentSignatureUrl: {
			type: String,
			default: "",
		},
		presidentSignaturePublicId: {
			type: String,
			default: "",
		},
		secretaryName: {
			type: String,
			default: "General Secretary",
		},
		secretaryTitle: {
			type: String,
			default: "General Secretary, Chhatak Uttar",
		},
		secretarySignatureUrl: {
			type: String,
			default: "",
		},
		secretarySignaturePublicId: {
			type: String,
			default: "",
		},
		fieldConfig: {
			type: mongoose.Schema.Types.Mixed,
			default: {
				email: false,
				dob: false,
				fatherName: false,
				rollNumber: false,
				regNumber: false,
				bloodGroup: false,
				emergencyContact: false,
				passingYear: false,
				gradeGpa: false,
			},
		},
	},
	{ timestamps: true }
);

const Settings =
	mongoose.models.Settings || mongoose.model("Settings", settingsSchema);

export default Settings;
