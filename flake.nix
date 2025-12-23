{
  description = "Command-line interface for Roon music player";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    (flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};

        roon-cli = pkgs.buildNpmPackage {
          pname = "roon-cli";
          version = "1.0.0";
          src = ./.;
          npmDepsHash = "sha256-gOnT8vGmh3fKtWK0Ak6VQrf8/7v5vZ4n07zKDSrYlqM=";
          nodejs = pkgs.nodejs_20;
          makeCacheWritable = true;

          buildPhase = ''
            runHook preBuild
            npm run build
            runHook postBuild
          '';

          installPhase = ''
            runHook preInstall
            mkdir -p $out/bin $out/lib/roon-cli
            cp -r dist $out/lib/roon-cli/
            cp -r node_modules $out/lib/roon-cli/
            cp package.json $out/lib/roon-cli/

            cat > $out/bin/roon <<EOF2
#!${pkgs.bash}/bin/bash
exec ${pkgs.nodejs_20}/bin/node $out/lib/roon-cli/dist/cli.cjs "\$@"
EOF2

            cat > $out/bin/roon-daemon <<EOF2
#!${pkgs.bash}/bin/bash
exec ${pkgs.nodejs_20}/bin/node $out/lib/roon-cli/dist/daemon.cjs "\$@"
EOF2

            chmod +x $out/bin/roon $out/bin/roon-daemon
            runHook postInstall
          '';

          meta = with pkgs.lib; {
            description = "Command-line interface for Roon music player";
            homepage = "https://github.com/EdgarPost/roon-cli";
            license = licenses.mit;
            platforms = platforms.linux ++ platforms.darwin;
          };
        };
      in
      {
        packages = {
          default = roon-cli;
          roon-cli = roon-cli;
        };

        apps = {
          default = { type = "app"; program = "${roon-cli}/bin/roon"; };
          roon = { type = "app"; program = "${roon-cli}/bin/roon"; };
          roon-daemon = { type = "app"; program = "${roon-cli}/bin/roon-daemon"; };
        };

        devShells.default = pkgs.mkShell {
          buildInputs = with pkgs; [ nodejs_20 nodePackages.npm ];
        };
      }
    )) // {
      # Home-manager module (system-agnostic, uses pkgs from caller)
      homeManagerModules.default = { config, lib, pkgs, ... }:
        let
          cfg = config.services.roon-cli;
          roon-cli = self.packages.${pkgs.stdenv.hostPlatform.system}.default;
        in
        {
          options.services.roon-cli = {
            enable = lib.mkEnableOption "roon-cli daemon";
          };

          config = lib.mkIf cfg.enable {
            home.packages = [ roon-cli ];
            systemd.user.services.roon-daemon = {
              Unit = {
                Description = "Roon CLI Daemon";
                After = [ "network.target" ];
              };
              Service = {
                Type = "simple";
                ExecStart = "${roon-cli}/bin/roon-daemon";
                Restart = "on-failure";
                RestartSec = 5;
              };
              Install = {
                WantedBy = [ "default.target" ];
              };
            };
          };
        };
    };
}
