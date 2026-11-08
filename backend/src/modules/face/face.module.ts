import { Logger, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppConfig } from '../../shared/config/app-config';
import { IdGenerator } from '../../shared/ids/id-generator';
import { AadhaarFaceVerifier } from './aadhaar/aadhaar-face.verifier';
import {
  AadhaarIdentityResolver,
  AsaClient,
  AuthXmlSigner,
  HttpAsaClient,
  UnconfiguredIdentityResolver,
  UnconfiguredSigner,
  XmlDsigSigner,
} from './aadhaar/aadhaar-gateways';
import { StaffModule } from '../staff/staff.module';
import { FaceTemplate } from './entities/face-template.entity';
import { DbFaceTemplateStore, FaceEnrolmentService } from './face-enrolment.service';
import { FaceTemplatesRepository } from './face-templates.repository';
import { FaceController } from './face.controller';
import { FaceVerifier } from './face-verifier';
import { FaceEngine, FaceTemplateStore, LocalFaceVerifier } from './local/local-face.verifier';
import { OnnxFaceEngine } from './local/onnx-face.engine';

/**
 * Face verification with a configuration switch (FACE_PROVIDER):
 *   local   -> LocalFaceVerifier   (YuNet + MiniFASNet + AuraFace, templates in the database)
 *   aadhaar -> AadhaarFaceVerifier (UIDAI FaceRD + Auth API via SMKC's ASA)
 * To plug in a real implementation, override the matching provider token below.
 */
@Module({
  imports: [TypeOrmModule.forFeature([FaceTemplate]), StaffModule],
  controllers: [FaceController],
  providers: [
    FaceTemplatesRepository,
    FaceEnrolmentService,
    { provide: FaceEngine, useClass: OnnxFaceEngine },
    { provide: FaceTemplateStore, useClass: DbFaceTemplateStore },
    { provide: AadhaarIdentityResolver, useClass: UnconfiguredIdentityResolver },
    {
      provide: AuthXmlSigner,
      inject: [AppConfig],
      useFactory: (config: AppConfig): AuthXmlSigner =>
        config.faceProvider === 'aadhaar'
          ? new XmlDsigSigner(config.aadhaar.signingKeyPath, config.aadhaar.signingCertPath)
          : new UnconfiguredSigner(),
    },
    {
      provide: AsaClient,
      inject: [AppConfig],
      useFactory: (config: AppConfig): AsaClient => new HttpAsaClient(config.aadhaar.timeoutMs),
    },
    {
      provide: FaceVerifier,
      inject: [AppConfig, FaceEngine, FaceTemplateStore, AadhaarIdentityResolver, AuthXmlSigner, AsaClient, IdGenerator],
      useFactory: (
        config: AppConfig,
        engine: FaceEngine,
        templates: FaceTemplateStore,
        identities: AadhaarIdentityResolver,
        signer: AuthXmlSigner,
        asa: AsaClient,
        ids: IdGenerator,
      ): FaceVerifier => {
        new Logger('Face').log(`Face verification provider: ${config.faceProvider}`);
        if (config.faceProvider === 'aadhaar') {
          return new AadhaarFaceVerifier(config.aadhaar, identities, signer, asa, ids);
        }
        return new LocalFaceVerifier(engine, templates, config.localFace);
      },
    },
  ],
  exports: [FaceVerifier, FaceEnrolmentService],
})
export class FaceModule {}
