f="programs/agentvault/src/revert.rs"
t=open(f).read()
n=chr(10)+"        "
a1="bump  = vault.bump,"
b1="constraint = !vault.is_closed @ AspError::VaultClosed,"
t=t.replace(a1,a1+n+b1)
a2="bump  = settlement_nft.bump,"
b2="constraint = settlement_nft.agent == agent.key()"
b2+=" @ AspError::UnauthorizedAgent,"
t=t.replace(a2,a2+n+b2)
open(f,"w").write(t)
