import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, Length } from 'class-validator';
import type { AuthUser } from '../../shared/auth/auth-user';
import { CurrentUser, Roles } from '../../shared/auth/decorators';
import { outranks, Role } from '../../shared/auth/roles';
import { AppError } from '../../shared/errors/app-error';
import { ErrorCode } from '../../shared/errors/error-codes';
import { CreateFaceEnrolmentDto, FaceEnrolmentDto, FaceEnrolmentListDto } from './dto/face-enrolment.dto';
import { FaceEnrolmentService } from './face-enrolment.service';
import { FaceVerifier } from './face-verifier';

export class CaptureOptionsQueryDto {
  @ApiPropertyOptional({ description: 'Who is being verified; defaults to the caller. Others only for inspectors and above (proxy marking).' })
  @IsOptional()
  @IsString()
  @Length(1, 64)
  staffId?: string;
}

export class FaceCaptureOptionsDto {
  @ApiProperty({ enum: ['local', 'aadhaar'] }) provider: 'local' | 'aadhaar';
  @ApiProperty({ enum: ['ML_KIT_LIVENESS_THEN_UPLOAD_CROP', 'LAUNCH_FACERD'] }) instructions: string;
  @ApiPropertyOptional({ description: 'Aadhaar only: transaction ID to echo back' }) txn?: string;
  @ApiPropertyOptional({ description: 'Aadhaar only: PidOptions XML for the FaceRD intent extra "request"' })
  pidOptionsXml?: string;
  @ApiPropertyOptional({ example: 'in.gov.uidai.rdservice.face.CAPTURE' }) intentAction?: string;
}

/**
 * Tells the app which capture flow to run. This is the switch that makes Aadhaar
 * plug-and-play on the phone: the app follows `instructions` and never hard-codes a provider.
 */
@ApiTags('face')
@ApiBearerAuth()
@Controller('face')
export class FaceController {
  constructor(
    private readonly face: FaceVerifier,
    private readonly enrolment: FaceEnrolmentService,
  ) {}

  @Get('capture-options')
  @ApiOperation({ summary: 'Which face capture flow the app should run (local or Aadhaar FaceRD)' })
  @ApiOkResponse({ type: FaceCaptureOptionsDto })
  captureOptions(
    @CurrentUser() user: AuthUser,
    @Query() query: CaptureOptionsQueryDto,
  ): Promise<FaceCaptureOptionsDto> {
    const staffId = query.staffId ?? user.staffId;
    // Coarse check here; the full team / same-ward rule is enforced when attendance is marked.
    if (staffId !== user.staffId && !outranks(user.role, Role.WORKER)) {
      throw new AppError(ErrorCode.FORBIDDEN);
    }
    return this.face.captureOptions(staffId);
  }

  @Get('enrolments/:staffId')
  @Roles(Role.ADMIN, Role.WARD_INSPECTOR)
  @ApiOperation({ summary: "A person's enrolled face photos (dates only; never the photo or embedding)" })
  @ApiOkResponse({ type: FaceEnrolmentListDto })
  listEnrolments(
    @CurrentUser() user: AuthUser,
    @Param('staffId', ParseUUIDPipe) staffId: string,
  ): Promise<FaceEnrolmentListDto> {
    return this.enrolment.list(user, staffId);
  }

  @Post('enrolments')
  @Roles(Role.ADMIN, Role.WARD_INSPECTOR)
  @ApiOperation({ summary: 'Add one enrolment photo (up to 5); the photo is embedded and dropped' })
  @ApiCreatedResponse({ type: FaceEnrolmentDto })
  enrol(@CurrentUser() user: AuthUser, @Body() dto: CreateFaceEnrolmentDto): Promise<FaceEnrolmentDto> {
    return this.enrolment.enrol(user, dto.staffId, Buffer.from(dto.imageBase64, 'base64'));
  }

  @Delete('enrolments/:staffId')
  @HttpCode(204)
  @Roles(Role.ADMIN, Role.WARD_INSPECTOR)
  @ApiOperation({ summary: "Remove all of a person's enrolment photos, so they can be enrolled again" })
  @ApiNoContentResponse()
  clearEnrolments(@CurrentUser() user: AuthUser, @Param('staffId', ParseUUIDPipe) staffId: string): Promise<void> {
    return this.enrolment.clear(user, staffId);
  }
}
