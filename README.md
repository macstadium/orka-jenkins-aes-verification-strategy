# Creating Orka Encryption Service

This article explains how to set up an encryption service within Orka.
The service is then used by the Orka plugin AES verification strategy to determine whether a VM belongs to a trusted cluster.  
The AES verification strategy is used to determine if a VM belongs to a trusted cluster. For this to happen, the VM must prove that is has access to a private symmetric key that is deployed in the cluster. This article explains how to set up the cluster so you can take advantage of the AES verification strategy.

The repository contains:

- Encryption service located in the `/encryption-service` folder - An Express Web app that accepts a GET request with a message on port 8080.  
   The service encrypts the message with a symmetric key that is provided via the `KEY` environment variable.  
   The service uses AES CDC algorithm for encryption.
- [Dockerfile](/encryption-service/Dockerfile) - Used to produce a Docker image that contains the encryption service app
- [deployment.yml](deployment.yml) file - Used to deploy a secret, deployment and a service resources within Kubernetes so they can be consumed by Orka

## Building the encryption service

The first step is to build the service Docker image.
To do that:

1. Navigate to the `/encryption-service` folder
1. Run `docker build -t <encryption_image> .` where `<encryption_image>` is the image name you want to create

Now you need to publish the encryption service in a container registry.  
To do that, run: `docker push <encryption_image>` where `<encryption_image>` is the image name you've just build.
**Note** The container registry should provide a public access to the image, so it can be used by Kubernetes.  
For example, you can use DockerHub.

## Deploying the encryption service

Before we can deploy Kubernetes resources inside Orka, we need to create kube accounts.
To do that, follow steps 1 to 3 on the [Orka Docs Page][kube-account]

Next, we need to update the [deployment.yml](deployment.yml) with the correct values for:

- `<secret_base_64>` - The symmetric key used for encryption and decryption in a Base64 format
- `<encryption_image>` - The name of the image built and published in the [previous step](#building-the-encryption-service)

Once this is done, we need to deploy the secret and encryption service in Kubernetes.
To do that, run: `kubectl apply -f deployment.yml`.

This will create:

- Kubernetes secret
- Kubernetes deployment
- Kubernetes service

Once ready, the service can be consumed from within Orka.  
To test it:

1. Create an Orka VM
1. SSH to that VM
1. Run `curl encryption-app.sandbox.svc.cluster.local/<message>` where `<message>` is any string. As a result you get an encrypted version of `<message>` with the symmetric key provided to the cluster.

## Configuring the Jenkins plugin to use the encryption service

The final step is to configure the Jenkins Orka plugin to use the encryption service to determine if a VM belongs to a trusted cluster.

To do that:

1. Create Jenkins credentials, containing the symmetric key. To do that:
   1. Go to `Manage Jenkins` -> `Manage Credentials`
   1. Select the desired store and domain. For instance `(global)` domain of the `Jenkins` store
   1. Click on `Add Credentials`
   1. Select `Username with passowrd` for `Kind`
   1. Paste the symmetric key as `Password`
1. Install the Orka plugin
1. Create a new Orka cloud. To do that:
   1. Go to `Manage Jenkins` -> `Manage Nodes and Clouds`
   1. Click on `Configure Clouds`
   1. Click on `Add a new cloud -> Orka Cloud`
1. Configure the cloud. To do that, follow the instructions on the [plugin page][plugin-page] for `Ephemeral Agents`
1. During the configuration of an Orka Template click `Advanced`. A new settings called `Verification Strategy` is shown
1. Select `AES Verification Strategy` and configure it
   1. Leave `Script remote path` to `/tmp`
   1. For `Encryptopn Script` provide `curl -sL encryption-app.sandbox.svc.cluster.local/$1`  
      This script is executed on the VM once it is booted. Jenkins passes a random string token as first parameter and expects the encrypted token as a result. In this case, we use the newly created encryption service to encrypt that token.
   1. For `AES key` select the credentials created in step 1 containing the symmetric key
1. Click `Save`

The configuration is ready. Now each time Jenkins creates a VM, it will verify whether the VM has access to the secret symmetric key or not.  
If the VM does not have the key, it will be deleted and a new one will be created.

## Alternative approach

[OpenSSL][openssl] can be used to encrypt the token instead of the REST service.  
The command you need to encrypt token is: `openssl enc -a -aes-256-cbc -md md5 -pass pass:<encryption_key>` where `<encryption_key>` is the symmetric key configured within Jenkins and the Orka cluster.

The command set in the `Encryptopn Script` option in the Jenkins plugin should be:  
`echo $1 openssl enc -a -aes-256-cbc -md md5 -pass pass:<encryption_key>` where `<encryption_key>` is the symmetric key configured within Jenkins and the Orka cluster. `$1` is the token generated by Jenkins. It is always passed as the first argument of the script.

## Troubleshooting

You can use [OpenSSL][openssl] to troubleshoot token decryption. The Orka plugin uses a similar command written in Java, so if the OpenSSL commands successfully decrypts the token, so should the plugin.  
The command is: `openssl enc -d -a -aes-256-cbc -pass pass:<encryption_key>` where `<encryption_key>` is the symmetric key configured within Jenkins and the Orka cluster.

[kube-account]: https://orkadocs.macstadium.com/docs/tapping-into-kubernetes
[plugin-page]: https://plugins.jenkins.io/macstadium-orka/
[openssl]: https://www.openssl.org/
