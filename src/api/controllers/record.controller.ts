import { Body, Controller, Get, Param, Post, Put, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Record } from '../schemas/record.schema';
import { CreateRecordRequestDTO } from '../dtos/create-record.request.dto';
import { UpdateRecordRequestDTO } from '../dtos/update-record.request.dto';
import {
  FindRecordsQueryDTO,
  PaginatedRecords,
} from '../dtos/find-records.query.dto';
import { RecordService } from '../services/record.service';
import { ParseMongoIdPipe } from '../../common/pipes/parse-mongo-id.pipe';

@ApiTags('records')
@Controller('records')
export class RecordController {
  constructor(private readonly recordService: RecordService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new record' })
  @ApiResponse({ status: 201, description: 'Record successfully created' })
  @ApiResponse({ status: 400, description: 'Bad Request' })
  @ApiResponse({ status: 409, description: 'Duplicate record (artist+album+format)' })
  create(@Body() request: CreateRecordRequestDTO): Promise<Record> {
    return this.recordService.create(request);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update an existing record' })
  @ApiResponse({ status: 200, description: 'Record updated successfully' })
  @ApiResponse({ status: 400, description: 'Invalid id' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  @ApiResponse({ status: 409, description: 'Duplicate record (artist+album+format)' })
  update(
    @Param('id', ParseMongoIdPipe) id: string,
    @Body() updateRecordDto: UpdateRecordRequestDTO,
  ): Promise<Record> {
    return this.recordService.update(id, updateRecordDto);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a record by id' })
  @ApiResponse({ status: 200, description: 'Record found' })
  @ApiResponse({ status: 400, description: 'Invalid id' })
  @ApiResponse({ status: 404, description: 'Record not found' })
  findOne(@Param('id', ParseMongoIdPipe) id: string): Promise<Record> {
    return this.recordService.findById(id);
  }

  @Get()
  @ApiOperation({ summary: 'Get records with optional filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of records' })
  findAll(
    @Query() query: FindRecordsQueryDTO,
  ): Promise<PaginatedRecords<Record>> {
    return this.recordService.find(query);
  }
}
