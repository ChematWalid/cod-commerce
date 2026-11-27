# State lives in its own private R2 bucket (never the public assets bucket) and is encrypted client-side, so the
# Turnstile secret and the origin private key it holds are unreadable without the passphrase.
#
# The bucket, its access key and the account endpoint come from a git-ignored backend.hcl (see backend.hcl.example)
# and AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY in the environment: `tofu init -backend-config=backend.hcl`.

terraform {
  backend "s3" {
    key    = "staging/edge.tfstate"
    region = "auto"

    # R2 speaks S3 but is not AWS: skip every AWS-only check.
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true

    # Lock with a conditional write next to the state (R2 supports If-None-Match).
    use_lockfile = true
  }

  encryption {
    key_provider "pbkdf2" "state" {
      passphrase = var.state_encryption_passphrase
    }

    method "aes_gcm" "state" {
      keys = key_provider.pbkdf2.state
    }

    state {
      method   = method.aes_gcm.state
      enforced = true
    }

    plan {
      method   = method.aes_gcm.state
      enforced = true
    }
  }
}
