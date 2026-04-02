/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/agentvault.json`.
 */
export type Agentvault = {
  "address": "5DWGriyPGA5Q4sc7ofBGE3sUUwj47JTnKoc7Dygh44rh",
  "metadata": {
    "name": "agentvault",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Agent Settlement Protocol — Clearing House for AI Agents on Solana"
  },
  "instructions": [
    {
      "name": "initialize",
      "discriminator": [
        175,
        175,
        109,
        31,
        13,
        152,
        155,
        237
      ],
      "accounts": [],
      "args": []
    }
  ]
};
